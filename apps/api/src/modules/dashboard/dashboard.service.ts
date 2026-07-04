import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, isNull, lt, ne, sql, sum } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  agendamentos,
  estoqueMovimentos,
  faturaItens,
  faturas,
  internacaoExecucoes,
  internacoes,
  itensCatalogo,
  orcamentos,
  responsaveis,
  tiposAtendimento,
  users,
} from '../../database/schema';
import { ComissoesService } from '../comissoes/comissoes.service';
import type { DashboardDto } from './dashboard.dto';

// Home por persona (doc 05 §1): um endpoint devolve o superset de KPIs; o front
// mostra o recorte do papel. Timezone por tenant → fase 2 (hoje = dia do servidor).
@Injectable()
export class DashboardService {
  constructor(
    private readonly database: DatabaseService,
    private readonly comissoes: ComissoesService,
  ) {}

  async resumo(tenantId: string, userId: string): Promise<DashboardDto> {
    const hoje0 = new Date();
    hoje0.setHours(0, 0, 0, 0);
    const amanha0 = new Date(hoje0.getTime() + 24 * 60 * 60 * 1000);
    const mes0 = new Date(hoje0.getFullYear(), hoje0.getMonth(), 1);

    const base = await this.database.withTenant(tenantId, async (tx) => {
      const agendaHoje = await tx
        .select({
          id: agendamentos.id,
          titulo: agendamentos.titulo,
          inicio: agendamentos.inicio,
          profissionalId: agendamentos.profissionalId,
          profissionalNome: users.name,
          cor: tiposAtendimento.cor,
        })
        .from(agendamentos)
        .leftJoin(users, eq(users.id, agendamentos.profissionalId))
        .leftJoin(tiposAtendimento, eq(tiposAtendimento.id, agendamentos.tipoAtendimentoId))
        .where(
          and(
            gte(agendamentos.inicio, hoje0),
            lt(agendamentos.inicio, amanha0),
            ne(agendamentos.status, 'cancelado'),
          ),
        )
        .orderBy(asc(agendamentos.inicio));

      const [internadosRow] = await tx
        .select({ n: count() })
        .from(internacoes)
        .where(eq(internacoes.status, 'internado'));

      const [pendentesRow] = await tx
        .select({ n: count() })
        .from(internacaoExecucoes)
        .innerJoin(internacoes, eq(internacoes.id, internacaoExecucoes.internacaoId))
        .where(and(isNull(internacaoExecucoes.executadaEm), eq(internacoes.status, 'internado')));

      const [faturasRow] = await tx
        .select({ n: count(), total: sum(faturas.totalCentavos) })
        .from(faturas)
        .where(eq(faturas.status, 'aberta'));

      const [receitaRow] = await tx
        .select({ total: sum(faturaItens.valorCentavos) })
        .from(faturaItens)
        .where(gte(faturaItens.createdAt, mes0));

      const [estoqueRow] = await tx
        .select({
          n: sql<number>`count(*)::int`,
        })
        .from(itensCatalogo)
        .where(
          and(
            eq(itensCatalogo.ativo, true),
            sql`${itensCatalogo.tipo} <> 'servico'`,
            sql`${itensCatalogo.estoqueMinimo} > 0`,
            sql`coalesce((select sum(${estoqueMovimentos.quantidade}) from ${estoqueMovimentos}
              where ${estoqueMovimentos.itemId} = ${itensCatalogo.id}), 0) < ${itensCatalogo.estoqueMinimo}`,
          ),
        );

      const [orcRow] = await tx
        .select({ n: count() })
        .from(orcamentos)
        .where(eq(orcamentos.status, 'aberto'));

      const [clientesRow] = await tx.select({ n: count() }).from(responsaveis);

      return {
        agendaHoje,
        internados: internadosRow?.n ?? 0,
        pendentes: pendentesRow?.n ?? 0,
        faturasAbertas: faturasRow?.n ?? 0,
        faturasAbertasCentavos: Number(faturasRow?.total ?? 0),
        receitaMesCentavos: Number(receitaRow?.total ?? 0),
        estoqueAbaixoMinimo: estoqueRow?.n ?? 0,
        orcamentosAbertos: orcRow?.n ?? 0,
        clientes: clientesRow?.n ?? 0,
      };
    });

    const extrato = await this.comissoes.extrato(tenantId, userId, mes0.toISOString());
    const minhasComissoesMesCentavos = extrato.reduce((s, l) => s + l.comissaoCentavos, 0);

    return {
      agendamentosHoje: base.agendaHoje.length,
      minhaAgendaHoje: base.agendaHoje.filter((a) => a.profissionalId === userId).length,
      proximos: base.agendaHoje.slice(0, 8).map((a) => ({
        id: a.id,
        titulo: a.titulo,
        inicio: a.inicio as unknown as string,
        profissionalNome: a.profissionalNome,
        cor: a.cor,
      })),
      internados: base.internados,
      execucoesPendentes: base.pendentes,
      faturasAbertas: base.faturasAbertas,
      faturasAbertasCentavos: base.faturasAbertasCentavos,
      receitaMesCentavos: base.receitaMesCentavos,
      estoqueAbaixoMinimo: base.estoqueAbaixoMinimo,
      orcamentosAbertos: base.orcamentosAbertos,
      clientes: base.clientes,
      minhasComissoesMesCentavos,
    };
  }
}
