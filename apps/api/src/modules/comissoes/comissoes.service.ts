import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import { DatabaseService, type Database } from '../../database/database.service';
import { comissaoRegras, faturaItens, itensCatalogo, memberships, users } from '../../database/schema';
import type { ApuracaoColaboradorDto, ApuracaoLinhaDto, CreateRegraDto, RegraDto } from './comissoes.dto';

// Comissionamento fase 1 (doc 05 §5): regra % por colaborador (regra por item
// sobrepõe a geral); apuração = fatura_itens com profissional no período.
// Fechamento/pagamento e extratos históricos → fase 2.
@Injectable()
export class ComissoesService {
  constructor(private readonly database: DatabaseService) {}

  // ───────── Regras ─────────

  async listRegras(tenantId: string): Promise<RegraDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: comissaoRegras.id,
          userId: comissaoRegras.userId,
          userNome: users.name,
          itemId: comissaoRegras.itemId,
          itemNome: itensCatalogo.nome,
          percentBps: comissaoRegras.percentBps,
        })
        .from(comissaoRegras)
        .innerJoin(users, eq(users.id, comissaoRegras.userId))
        .leftJoin(itensCatalogo, eq(itensCatalogo.id, comissaoRegras.itemId))
        .orderBy(asc(users.name));
      return rows.map((r) => ({ ...r, itemNome: r.itemNome ?? null }));
    });
  }

  /** Cria/atualiza a regra do par (colaborador × item). Item nulo = regra geral. */
  async upsertRegra(tenantId: string, dto: CreateRegraDto): Promise<RegraDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const membro = await tx.query.memberships.findFirst({ where: eq(memberships.userId, dto.userId) });
      if (!membro) throw new BadRequestException('Colaborador não é membro desta clínica');
      if (dto.itemId) {
        const item = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, dto.itemId) });
        if (!item) throw new NotFoundException('Item do catálogo não encontrado');
      }

      // Unicidade da regra geral (itemId null) garantida aqui: índice único não
      // cobre NULLs no Postgres (NULLs são distintos entre si).
      const existente = await tx.query.comissaoRegras.findFirst({
        where: and(
          eq(comissaoRegras.userId, dto.userId),
          dto.itemId ? eq(comissaoRegras.itemId, dto.itemId) : isNull(comissaoRegras.itemId),
        ),
      });

      const row = existente
        ? (
            await tx
              .update(comissaoRegras)
              .set({ percentBps: dto.percentBps })
              .where(eq(comissaoRegras.id, existente.id))
              .returning()
          )[0]
        : (
            await tx
              .insert(comissaoRegras)
              .values({ tenantId, userId: dto.userId, itemId: dto.itemId ?? null, percentBps: dto.percentBps })
              .returning()
          )[0];

      const user = await tx.query.users.findFirst({ where: eq(users.id, dto.userId) });
      const item = row.itemId
        ? await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, row.itemId) })
        : undefined;
      return {
        id: row.id,
        userId: row.userId,
        userNome: user?.name ?? '',
        itemId: row.itemId,
        itemNome: item?.nome ?? null,
        percentBps: row.percentBps,
      };
    });
  }

  async removeRegra(tenantId: string, id: string): Promise<{ ok: boolean }> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [rem] = await tx.delete(comissaoRegras).where(eq(comissaoRegras.id, id)).returning({ id: comissaoRegras.id });
      if (!rem) throw new NotFoundException('Regra não encontrada');
      return { ok: true };
    });
  }

  // ───────── Apuração ─────────

  /** Resumo por colaborador no período (fechamento — doc 05 §5.1). */
  async apurar(tenantId: string, from?: string, to?: string): Promise<ApuracaoColaboradorDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const lancamentos = await this.lancamentosComRegra(tx, from, to);
      const porUser = new Map<string, ApuracaoColaboradorDto>();
      for (const l of lancamentos) {
        const atual = porUser.get(l.userId) ?? {
          userId: l.userId,
          nome: l.nome,
          baseCentavos: 0,
          comissaoCentavos: 0,
          lancamentos: 0,
        };
        atual.baseCentavos += l.valorCentavos;
        atual.comissaoCentavos += l.comissaoCentavos;
        atual.lancamentos += 1;
        porUser.set(l.userId, atual);
      }
      return [...porUser.values()].sort((a, b) => b.comissaoCentavos - a.comissaoCentavos);
    });
  }

  /** Extrato de um colaborador ("minhas comissões" — doc 05 §5.3). */
  async extrato(tenantId: string, userId: string, from?: string, to?: string): Promise<ApuracaoLinhaDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const lancamentos = await this.lancamentosComRegra(tx, from, to);
      return lancamentos
        .filter((l) => l.userId === userId)
        .map((l) => ({
          descricao: l.descricao,
          valorCentavos: l.valorCentavos,
          percentBps: l.percentBps,
          comissaoCentavos: l.comissaoCentavos,
          criadoEm: l.criadoEm,
        }));
    });
  }

  /** Junta fatura_itens comissionáveis do período com a melhor regra aplicável. */
  private async lancamentosComRegra(tx: Database, from?: string, to?: string) {
    const conds = [isNotNull(faturaItens.profissionalId)];
    if (from) conds.push(gte(faturaItens.createdAt, new Date(from)));
    if (to) conds.push(lte(faturaItens.createdAt, new Date(to)));

    const itens = await tx
      .select({
        descricao: faturaItens.descricao,
        valorCentavos: faturaItens.valorCentavos,
        itemId: faturaItens.itemId,
        userId: faturaItens.profissionalId,
        nome: users.name,
        criadoEm: faturaItens.createdAt,
      })
      .from(faturaItens)
      .innerJoin(users, eq(users.id, faturaItens.profissionalId))
      .where(and(...conds))
      .orderBy(asc(faturaItens.createdAt))
      .limit(2000);

    const regras = await tx.select().from(comissaoRegras);
    const regraDe = (userId: string, itemId: string | null): number | null => {
      if (itemId) {
        const especifica = regras.find((r) => r.userId === userId && r.itemId === itemId);
        if (especifica) return especifica.percentBps;
      }
      const geral = regras.find((r) => r.userId === userId && r.itemId === null);
      return geral ? geral.percentBps : null;
    };

    return itens
      .map((i) => {
        const bps = regraDe(i.userId!, i.itemId);
        // Sem regra aplicável → item não comissiona (fica de fora). Uma regra
        // explícita de 0% ENTRA na apuração (comissão zero), para o colaborador
        // aparecer com sua base — só não gera valor.
        if (bps == null) return null;
        return {
          descricao: i.descricao,
          valorCentavos: i.valorCentavos,
          userId: i.userId!,
          nome: i.nome,
          percentBps: bps,
          comissaoCentavos: Math.floor((i.valorCentavos * bps) / 10000),
          criadoEm: i.criadoEm as unknown as string,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }
}
