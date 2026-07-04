import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { DatabaseService, type Database } from '../../database/database.service';
import {
  faturaItens,
  faturas,
  formasRecebimento,
  recebimentos,
  responsaveis,
} from '../../database/schema';
import type {
  CreateFormaDto,
  FaturaResumoDto,
  FormaRecebimentoDto,
  OkDto,
  ReceberDto,
  ReceberResultDto,
  RecebimentoDto,
  SaldoClienteDto,
  UpdateFormaDto,
} from './financeiro.dto';

// Financeiro fase 2 (doc 13 §1): recebimento PARCIAL, formas de recebimento e
// saldo do cliente. O status da fatura é derivado da soma dos recebimentos.
@Injectable()
export class FinanceiroService {
  constructor(private readonly database: DatabaseService) {}

  private recebidoExpr = sql<number>`coalesce((select sum(${recebimentos.valorCentavos})
    from ${recebimentos} where ${recebimentos.faturaId} = ${faturas.id}), 0)::int`;

  async listFaturas(tenantId: string, status?: string): Promise<FaturaResumoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(faturas.tenantId, tenantId)];
      if (status) conds.push(eq(faturas.status, status));
      const rows = await tx
        .select({
          id: faturas.id,
          responsavelId: faturas.responsavelId,
          responsavelNome: responsaveis.nome,
          status: faturas.status,
          totalCentavos: faturas.totalCentavos,
          recebidoCentavos: this.recebidoExpr,
          itens: sql<number>`(select count(*)::int from ${faturaItens} where ${faturaItens.faturaId} = ${faturas.id})`,
          criadaEm: faturas.createdAt,
        })
        .from(faturas)
        .innerJoin(responsaveis, eq(responsaveis.id, faturas.responsavelId))
        .where(and(...conds))
        .orderBy(desc(faturas.createdAt))
        .limit(200);
      return rows.map((r) => ({ ...r, criadaEm: r.criadaEm as unknown as string }));
    });
  }

  /** Registra um recebimento (parcial ou integral) e recalcula o status. */
  async receber(tenantId: string, id: string, dto: ReceberDto): Promise<ReceberResultDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const fatura = await tx.query.faturas.findFirst({ where: eq(faturas.id, id) });
      if (!fatura) throw new NotFoundException('Fatura não encontrada');
      if (fatura.status === 'cancelada') throw new BadRequestException('Fatura cancelada');
      if (fatura.status === 'paga') throw new BadRequestException('Fatura já quitada');

      if (dto.formaId) {
        const forma = await tx.query.formasRecebimento.findFirst({ where: eq(formasRecebimento.id, dto.formaId) });
        if (!forma) throw new NotFoundException('Forma de recebimento não encontrada');
      }

      const recebidoAntes = await this.recebido(tx, id);
      const saldo = fatura.totalCentavos - recebidoAntes;
      if (dto.valorCentavos > saldo) {
        throw new BadRequestException(`Valor acima do saldo em aberto (${saldo} centavos)`);
      }

      await tx.insert(recebimentos).values({
        tenantId,
        faturaId: id,
        formaId: dto.formaId ?? null,
        valorCentavos: dto.valorCentavos,
        observacao: dto.observacao ?? null,
      });

      const recebido = recebidoAntes + dto.valorCentavos;
      const novoStatus = recebido >= fatura.totalCentavos ? 'paga' : 'parcial';
      await tx.update(faturas).set({ status: novoStatus, updatedAt: new Date() }).where(eq(faturas.id, id));

      return {
        ok: true,
        status: novoStatus,
        recebidoCentavos: recebido,
        saldoCentavos: fatura.totalCentavos - recebido,
      };
    });
  }

  /** Baixa integral (quita o saldo restante numa tacada). */
  async pagar(tenantId: string, id: string): Promise<OkDto> {
    const res = await this.database.withTenant(tenantId, async (tx) => {
      const fatura = await tx.query.faturas.findFirst({ where: eq(faturas.id, id) });
      if (!fatura) throw new NotFoundException('Fatura não encontrada');
      if (fatura.status === 'cancelada') throw new BadRequestException('Fatura cancelada');
      if (fatura.status === 'paga') throw new BadRequestException('Fatura já quitada');
      const saldo = fatura.totalCentavos - (await this.recebido(tx, id));
      return { saldo };
    });
    if (res.saldo > 0) {
      await this.receber(tenantId, id, { valorCentavos: res.saldo });
    }
    return { ok: true };
  }

  async listRecebimentos(tenantId: string, id: string): Promise<RecebimentoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: recebimentos.id,
          valorCentavos: recebimentos.valorCentavos,
          formaId: recebimentos.formaId,
          formaNome: formasRecebimento.nome,
          observacao: recebimentos.observacao,
          criadoEm: recebimentos.createdAt,
        })
        .from(recebimentos)
        .leftJoin(formasRecebimento, eq(formasRecebimento.id, recebimentos.formaId))
        .where(eq(recebimentos.faturaId, id))
        .orderBy(desc(recebimentos.createdAt));
      return rows.map((r) => ({ ...r, criadoEm: r.criadoEm as unknown as string }));
    });
  }

  // ───────── Saldo do cliente (doc 13 §1, movido de Vendas 4.9) ─────────

  async saldos(tenantId: string): Promise<SaldoClienteDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          responsavelId: faturas.responsavelId,
          responsavelNome: responsaveis.nome,
          devedorCentavos: sql<number>`sum(${faturas.totalCentavos} - ${this.recebidoExpr})::int`,
          faturasAbertas: sql<number>`count(*)::int`,
        })
        .from(faturas)
        .innerJoin(responsaveis, eq(responsaveis.id, faturas.responsavelId))
        .where(and(eq(faturas.tenantId, tenantId), ne(faturas.status, 'cancelada'), ne(faturas.status, 'paga')))
        .groupBy(faturas.responsavelId, responsaveis.nome)
        .orderBy(desc(sql`sum(${faturas.totalCentavos} - ${this.recebidoExpr})`))
        .limit(500);
      return rows.filter((r) => r.devedorCentavos > 0);
    });
  }

  async saldoDe(tenantId: string, responsavelId: string): Promise<SaldoClienteDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, responsavelId) });
      if (!resp) throw new NotFoundException('Cliente não encontrado');
      const [row] = await tx
        .select({
          devedorCentavos: sql<number>`coalesce(sum(${faturas.totalCentavos} - ${this.recebidoExpr}), 0)::int`,
          faturasAbertas: sql<number>`count(*)::int`,
        })
        .from(faturas)
        .where(
          and(
            eq(faturas.responsavelId, responsavelId),
            ne(faturas.status, 'cancelada'),
            ne(faturas.status, 'paga'),
          ),
        );
      return {
        responsavelId,
        responsavelNome: resp.nome,
        devedorCentavos: row?.devedorCentavos ?? 0,
        faturasAbertas: row?.faturasAbertas ?? 0,
      };
    });
  }

  // ───────── Formas de recebimento ─────────

  async listFormas(tenantId: string, incluirInativos = false): Promise<FormaRecebimentoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(formasRecebimento.tenantId, tenantId)];
      if (!incluirInativos) conds.push(eq(formasRecebimento.ativo, true));
      const rows = await tx
        .select()
        .from(formasRecebimento)
        .where(and(...conds))
        .orderBy(asc(formasRecebimento.nome));
      return rows.map(this.toFormaDto);
    });
  }

  async createForma(tenantId: string, dto: CreateFormaDto): Promise<FormaRecebimentoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .insert(formasRecebimento)
        .values({ tenantId, nome: dto.nome, tipo: dto.tipo, taxaBps: dto.taxaBps ?? 0 })
        .returning();
      return this.toFormaDto(row);
    });
  }

  async updateForma(tenantId: string, id: string, dto: UpdateFormaDto): Promise<FormaRecebimentoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(formasRecebimento)
        .set({
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          ...(dto.taxaBps !== undefined ? { taxaBps: dto.taxaBps } : {}),
          ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
          updatedAt: new Date(),
        })
        .where(eq(formasRecebimento.id, id))
        .returning();
      if (!row) throw new NotFoundException('Forma não encontrada');
      return this.toFormaDto(row);
    });
  }

  private async recebido(tx: Database, faturaId: string): Promise<number> {
    const [row] = await tx
      .select({ total: sql<number>`coalesce(sum(${recebimentos.valorCentavos}), 0)::int` })
      .from(recebimentos)
      .where(eq(recebimentos.faturaId, faturaId));
    return row?.total ?? 0;
  }

  private toFormaDto(r: typeof formasRecebimento.$inferSelect): FormaRecebimentoDto {
    return { id: r.id, nome: r.nome, tipo: r.tipo, taxaBps: r.taxaBps, ativo: r.ativo };
  }
}
