import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DatabaseService, type Database } from '../../database/database.service';
import { itensCatalogo, orcamentoItens, orcamentos, responsaveis } from '../../database/schema';
import { FaturamentoService } from '../financeiro/faturamento.service';
import type {
  AddOrcamentoItemDto,
  ConverterResultDto,
  CreateOrcamentoDto,
  OrcamentoDetalheDto,
  OrcamentoItemDto,
  OrcamentoResumoDto,
} from './vendas.dto';

// Vendas fase 1 (doc 05 §4.11/§2.2): orçamento acoplado à ficha do cliente,
// itens por código do catálogo, aprovação e CONVERSÃO em fatura (lança tudo na
// fatura aberta via FaturamentoService). Modelos/pacotes e dashboard → fase 2.
@Injectable()
export class VendasService {
  constructor(
    private readonly database: DatabaseService,
    private readonly faturamento: FaturamentoService,
  ) {}

  async list(tenantId: string, status?: string, responsavelId?: string): Promise<OrcamentoResumoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(orcamentos.tenantId, tenantId)];
      if (status) conds.push(eq(orcamentos.status, status));
      if (responsavelId) conds.push(eq(orcamentos.responsavelId, responsavelId));
      const rows = await tx
        .select({
          o: orcamentos,
          responsavelNome: responsaveis.nome,
          totalCentavos: sql<number>`coalesce((select sum(${orcamentoItens.valorCentavos} * ${orcamentoItens.quantidade})
            from ${orcamentoItens} where ${orcamentoItens.orcamentoId} = ${orcamentos.id}), 0)::int`,
          itens: sql<number>`(select count(*)::int from ${orcamentoItens}
            where ${orcamentoItens.orcamentoId} = ${orcamentos.id})`,
        })
        .from(orcamentos)
        .innerJoin(responsaveis, eq(responsaveis.id, orcamentos.responsavelId))
        .where(and(...conds))
        .orderBy(desc(orcamentos.createdAt))
        .limit(200);
      return rows.map((r) => this.toResumo(r.o, r.responsavelNome, r.totalCentavos, r.itens));
    });
  }

  async create(tenantId: string, dto: CreateOrcamentoDto): Promise<OrcamentoResumoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, dto.responsavelId) });
      if (!resp) throw new NotFoundException('Cliente não encontrado');
      const [novo] = await tx
        .insert(orcamentos)
        .values({ tenantId, responsavelId: dto.responsavelId, observacoes: dto.observacoes ?? null })
        .returning();
      return this.toResumo(novo, resp.nome, 0, 0);
    });
  }

  async detalhe(tenantId: string, id: string): Promise<OrcamentoDetalheDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const base = await this.carregar(tx, id);
      const linhas = await tx
        .select()
        .from(orcamentoItens)
        .where(eq(orcamentoItens.orcamentoId, id))
        .orderBy(asc(orcamentoItens.createdAt));
      const total = linhas.reduce((s, l) => s + l.valorCentavos * l.quantidade, 0);
      return {
        ...this.toResumo(base.orcamento, base.responsavelNome, total, linhas.length),
        linhas: linhas.map(this.toItemDto),
      };
    });
  }

  async addItem(tenantId: string, id: string, dto: AddOrcamentoItemDto): Promise<OrcamentoItemDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const { orcamento } = await this.carregar(tx, id);
      if (orcamento.status !== 'aberto') throw new BadRequestException('Orçamento não está aberto');

      let descricao = dto.descricao?.trim();
      let valor = dto.valorCentavos ?? null;
      if (dto.itemId) {
        const item = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, dto.itemId) });
        if (!item) throw new NotFoundException('Item do catálogo não encontrado');
        descricao = descricao || item.nome;
        valor = valor ?? item.precoCentavos;
      }
      if (!descricao) throw new BadRequestException('Informe a descrição (ou um item do catálogo)');
      if (valor == null) throw new BadRequestException('Informe o valor (ou um item do catálogo)');

      const [linha] = await tx
        .insert(orcamentoItens)
        .values({
          tenantId,
          orcamentoId: id,
          itemId: dto.itemId ?? null,
          descricao,
          quantidade: dto.quantidade ?? 1,
          valorCentavos: valor,
        })
        .returning();
      await this.touch(tx, id);
      return this.toItemDto(linha);
    });
  }

  async removeItem(tenantId: string, id: string, linhaId: string): Promise<{ ok: boolean }> {
    return this.database.withTenant(tenantId, async (tx) => {
      const { orcamento } = await this.carregar(tx, id);
      if (orcamento.status !== 'aberto') throw new BadRequestException('Orçamento não está aberto');
      const [rem] = await tx
        .delete(orcamentoItens)
        .where(and(eq(orcamentoItens.id, linhaId), eq(orcamentoItens.orcamentoId, id)))
        .returning({ id: orcamentoItens.id });
      if (!rem) throw new NotFoundException('Item não encontrado');
      await this.touch(tx, id);
      return { ok: true };
    });
  }

  async updateStatus(tenantId: string, id: string, status: string): Promise<OrcamentoResumoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const { orcamento, responsavelNome } = await this.carregar(tx, id);
      if (orcamento.status === 'convertido') throw new BadRequestException('Orçamento já convertido');
      const [upd] = await tx
        .update(orcamentos)
        .set({ status, updatedAt: new Date() })
        .where(eq(orcamentos.id, id))
        .returning();
      const [tot] = await tx
        .select({
          total: sql<number>`coalesce(sum(${orcamentoItens.valorCentavos} * ${orcamentoItens.quantidade}), 0)::int`,
          n: sql<number>`count(*)::int`,
        })
        .from(orcamentoItens)
        .where(eq(orcamentoItens.orcamentoId, id));
      return this.toResumo(upd, responsavelNome, tot?.total ?? 0, tot?.n ?? 0);
    });
  }

  /** Converte o orçamento em cobrança: lança cada linha na fatura aberta. */
  async converter(tenantId: string, id: string): Promise<ConverterResultDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const { orcamento } = await this.carregar(tx, id);
      if (orcamento.status === 'convertido') throw new BadRequestException('Orçamento já convertido');
      if (orcamento.status === 'recusado') throw new BadRequestException('Orçamento recusado não pode ser convertido');

      const linhas = await tx.select().from(orcamentoItens).where(eq(orcamentoItens.orcamentoId, id));
      if (linhas.length === 0) throw new BadRequestException('Orçamento sem itens');

      let total = 0;
      for (const linha of linhas) {
        const valor = linha.valorCentavos * linha.quantidade;
        if (valor <= 0) continue;
        await this.faturamento.lancar(tx, tenantId, orcamento.responsavelId, {
          descricao: `orçamento: ${linha.descricao}${linha.quantidade > 1 ? ` x${linha.quantidade}` : ''}`,
          valorCentavos: valor,
        });
        total += valor;
      }

      await tx
        .update(orcamentos)
        .set({ status: 'convertido', updatedAt: new Date() })
        .where(eq(orcamentos.id, id));
      return { ok: true, totalCentavos: total };
    });
  }

  private async carregar(tx: Database, id: string) {
    const orcamento = await tx.query.orcamentos.findFirst({ where: eq(orcamentos.id, id) });
    if (!orcamento) throw new NotFoundException('Orçamento não encontrado');
    const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, orcamento.responsavelId) });
    return { orcamento, responsavelNome: resp?.nome ?? '' };
  }

  private async touch(tx: Database, id: string): Promise<void> {
    await tx.update(orcamentos).set({ updatedAt: new Date() }).where(eq(orcamentos.id, id));
  }

  private toResumo(
    o: typeof orcamentos.$inferSelect,
    responsavelNome: string,
    totalCentavos: number,
    itens: number,
  ): OrcamentoResumoDto {
    return {
      id: o.id,
      responsavelId: o.responsavelId,
      responsavelNome,
      status: o.status,
      totalCentavos,
      itens,
      observacoes: o.observacoes,
      criadoEm: o.createdAt as unknown as string,
    };
  }

  private toItemDto(l: typeof orcamentoItens.$inferSelect): OrcamentoItemDto {
    return {
      id: l.id,
      itemId: l.itemId,
      descricao: l.descricao,
      quantidade: l.quantidade,
      valorCentavos: l.valorCentavos,
    };
  }
}
