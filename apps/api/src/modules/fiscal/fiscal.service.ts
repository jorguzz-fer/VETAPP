import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { fiscalConfig, faturas, notasFiscais, responsaveis } from '../../database/schema';
import { FiscalProviderFactory } from './fiscal-provider';
import type {
  FiscalConfigDto,
  NotaFiscalDto,
  UpdateFiscalConfigDto,
} from './fiscal.dto';

// Fiscal (doc 13 §3). Config do emitente + ciclo de vida da nota. A emissão em si
// é delegada ao FiscalProvider (driver 'manual' por ora). Tudo tenant-scoped
// (withTenant + RLS).
@Injectable()
export class FiscalService {
  constructor(
    private readonly database: DatabaseService,
    private readonly providers: FiscalProviderFactory,
  ) {}

  /** Config do tenant (cria uma default na primeira leitura). */
  async getConfig(tenantId: string): Promise<FiscalConfigDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      let row = await tx.query.fiscalConfig.findFirst({ where: eq(fiscalConfig.tenantId, tenantId) });
      if (!row) {
        [row] = await tx.insert(fiscalConfig).values({ tenantId }).returning();
      }
      return this.toConfigDto(row);
    });
  }

  async updateConfig(tenantId: string, dto: UpdateFiscalConfigDto): Promise<FiscalConfigDto> {
    await this.getConfig(tenantId); // garante existência
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(fiscalConfig)
        .set({
          ...(dto.cnpj !== undefined ? { cnpj: dto.cnpj } : {}),
          ...(dto.razaoSocial !== undefined ? { razaoSocial: dto.razaoSocial } : {}),
          ...(dto.inscricaoMunicipal !== undefined ? { inscricaoMunicipal: dto.inscricaoMunicipal } : {}),
          ...(dto.regimeTributario !== undefined ? { regimeTributario: dto.regimeTributario } : {}),
          ...(dto.serieNfse !== undefined ? { serieNfse: dto.serieNfse } : {}),
          ...(dto.proximoNumero !== undefined ? { proximoNumero: dto.proximoNumero } : {}),
          ...(dto.provedor !== undefined ? { provedor: dto.provedor } : {}),
          ...(dto.ambiente !== undefined ? { ambiente: dto.ambiente } : {}),
          ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
          updatedAt: new Date(),
        })
        .where(eq(fiscalConfig.tenantId, tenantId))
        .returning();
      return this.toConfigDto(row);
    });
  }

  async listNotas(tenantId: string, status?: string): Promise<NotaFiscalDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(notasFiscais.tenantId, tenantId)];
      if (status) conds.push(eq(notasFiscais.status, status));
      const rows = await tx
        .select({
          id: notasFiscais.id,
          faturaId: notasFiscais.faturaId,
          responsavelId: notasFiscais.responsavelId,
          responsavelNome: responsaveis.nome,
          tipo: notasFiscais.tipo,
          status: notasFiscais.status,
          numero: notasFiscais.numero,
          serie: notasFiscais.serie,
          valorCentavos: notasFiscais.valorCentavos,
          mensagem: notasFiscais.mensagem,
          emitidaEm: notasFiscais.emitidaEm,
          createdAt: notasFiscais.createdAt,
        })
        .from(notasFiscais)
        .innerJoin(responsaveis, eq(responsaveis.id, notasFiscais.responsavelId))
        .where(and(...conds))
        .orderBy(desc(notasFiscais.createdAt))
        .limit(300);
      return rows.map((r) => this.toNotaDto(r));
    });
  }

  /** Cria uma nota (rascunho) a partir de uma fatura. */
  async criarDaFatura(tenantId: string, faturaId: string, tipo = 'nfse'): Promise<NotaFiscalDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const fatura = await tx.query.faturas.findFirst({ where: eq(faturas.id, faturaId) });
      if (!fatura) throw new NotFoundException('Fatura não encontrada');
      if (fatura.status === 'cancelada') throw new BadRequestException('Fatura cancelada');

      // Evita duplicar: já existe nota ativa (não cancelada) para esta fatura?
      const existente = await tx.query.notasFiscais.findFirst({
        where: and(eq(notasFiscais.faturaId, faturaId), ne(notasFiscais.status, 'cancelada')),
      });
      if (existente) throw new BadRequestException('Já existe uma nota para esta fatura');

      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, fatura.responsavelId) });
      const [row] = await tx
        .insert(notasFiscais)
        .values({
          tenantId,
          faturaId,
          responsavelId: fatura.responsavelId,
          tipo,
          status: 'rascunho',
          valorCentavos: fatura.totalCentavos,
        })
        .returning();
      return this.toNotaDto({ ...row, responsavelNome: resp?.nome ?? null });
    });
  }

  /** Emite a nota via provedor. No modo manual, numera pela série do config. */
  async emitir(tenantId: string, notaId: string): Promise<NotaFiscalDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const nota = await tx.query.notasFiscais.findFirst({ where: eq(notasFiscais.id, notaId) });
      if (!nota) throw new NotFoundException('Nota não encontrada');
      if (nota.status !== 'rascunho' && nota.status !== 'rejeitada') {
        throw new BadRequestException(`Nota não pode ser emitida (status: ${nota.status})`);
      }
      // Lock no config (SELECT ... FOR UPDATE): serializa emissões concorrentes do
      // mesmo tenant, garantindo que cada uma leia/incremente proximo_numero sem
      // colidir. O índice único parcial (0019) é o backstop no banco.
      const [config] = await tx
        .select()
        .from(fiscalConfig)
        .where(eq(fiscalConfig.tenantId, tenantId))
        .for('update');
      if (!config) throw new BadRequestException('Configure o Fiscal antes de emitir');
      if (!config.ativo) throw new BadRequestException('Emissão fiscal desativada (ative na configuração)');

      // Re-snapshot do valor: a nota reflete o total ATUAL da fatura na emissão
      // (itens lançados depois do rascunho não deixam a nota defasada).
      const fatura = await tx.query.faturas.findFirst({ where: eq(faturas.id, nota.faturaId) });
      const valorCentavos = fatura?.totalCentavos ?? nota.valorCentavos;

      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, nota.responsavelId) });
      const provider = this.providers.resolve(config.provedor);
      const result = await provider.emitir({
        nota,
        config,
        responsavelNome: resp?.nome ?? '',
        responsavelDocumento: resp?.documento ?? null,
      });

      let numero = result.numero ?? nota.numero;
      let serie = result.serie ?? nota.serie;
      // Numeração própria (modo manual): série + sequência do config.
      if (result.status === 'emitida' && !numero) {
        numero = String(config.proximoNumero);
        serie = config.serieNfse;
        await tx
          .update(fiscalConfig)
          .set({ proximoNumero: config.proximoNumero + 1, updatedAt: new Date() })
          .where(eq(fiscalConfig.id, config.id));
      }

      const [row] = await tx
        .update(notasFiscais)
        .set({
          status: result.status,
          numero,
          serie,
          valorCentavos,
          providerRef: result.providerRef ?? nota.providerRef,
          mensagem: result.mensagem ?? null,
          emitidaEm: result.status === 'emitida' ? new Date() : nota.emitidaEm,
          updatedAt: new Date(),
        })
        .where(eq(notasFiscais.id, notaId))
        .returning();
      return this.toNotaDto({ ...row, responsavelNome: resp?.nome ?? null });
    });
  }

  async cancelar(tenantId: string, notaId: string, motivo: string): Promise<NotaFiscalDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const nota = await tx.query.notasFiscais.findFirst({ where: eq(notasFiscais.id, notaId) });
      if (!nota) throw new NotFoundException('Nota não encontrada');
      if (nota.status !== 'emitida') {
        throw new BadRequestException('Só é possível cancelar uma nota emitida');
      }
      const config = await tx.query.fiscalConfig.findFirst({ where: eq(fiscalConfig.tenantId, tenantId) });
      const provider = this.providers.resolve(config?.provedor ?? 'manual');
      const res = await provider.cancelar(nota, motivo);
      if (!res.ok) throw new BadRequestException(res.mensagem ?? 'Provedor recusou o cancelamento');

      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, nota.responsavelId) });
      const [row] = await tx
        .update(notasFiscais)
        .set({ status: 'cancelada', mensagem: motivo, updatedAt: new Date() })
        .where(eq(notasFiscais.id, notaId))
        .returning();
      return this.toNotaDto({ ...row, responsavelNome: resp?.nome ?? null });
    });
  }

  // ───────── mapeadores ─────────

  private toConfigDto(r: typeof fiscalConfig.$inferSelect): FiscalConfigDto {
    return {
      id: r.id,
      cnpj: r.cnpj,
      razaoSocial: r.razaoSocial,
      inscricaoMunicipal: r.inscricaoMunicipal,
      regimeTributario: r.regimeTributario,
      serieNfse: r.serieNfse,
      proximoNumero: r.proximoNumero,
      provedor: r.provedor,
      ambiente: r.ambiente,
      ativo: r.ativo,
    };
  }

  private toNotaDto(r: {
    id: string;
    faturaId: string;
    responsavelId: string;
    responsavelNome: string | null;
    tipo: string;
    status: string;
    numero: string | null;
    serie: string | null;
    valorCentavos: number;
    mensagem: string | null;
    emitidaEm: unknown;
    createdAt: unknown;
  }): NotaFiscalDto {
    return {
      id: r.id,
      faturaId: r.faturaId,
      responsavelId: r.responsavelId,
      responsavelNome: r.responsavelNome,
      tipo: r.tipo,
      status: r.status,
      numero: r.numero,
      serie: r.serie,
      valorCentavos: r.valorCentavos,
      mensagem: r.mensagem,
      emitidaEm: (r.emitidaEm as Date | null)?.toISOString() ?? null,
      criadaEm: (r.createdAt as Date) instanceof Date ? (r.createdAt as Date).toISOString() : (r.createdAt as string),
    };
  }
}
