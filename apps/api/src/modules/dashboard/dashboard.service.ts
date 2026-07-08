import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, isNull, lt, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  agendamentos,
  faturas,
  formasRecebimento,
  internacaoExecucoes,
  internacoes,
  orcamentos,
  recebimentos,
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
        .select({ n: count() })
        .from(faturas)
        .where(eq(faturas.status, 'aberta'));

      // Receita líquida do mês (doc 16 D2): recebido no mês, líquido da taxa da forma.
      // bruto = Σ recebimentos; taxa = Σ (valor × bps) → líquida = bruto − taxa/10000.
      const [recebRow] = await tx
        .select({
          bruto: sql<number>`coalesce(sum(${recebimentos.valorCentavos}), 0)::int`,
          taxa: sql<number>`coalesce(sum(${recebimentos.valorCentavos} * coalesce(${formasRecebimento.taxaBps}, 0)), 0)`,
        })
        .from(recebimentos)
        .leftJoin(formasRecebimento, eq(formasRecebimento.id, recebimentos.formaId))
        .where(gte(recebimentos.createdAt, mes0));

      // Ticket médio do mês (doc 16 D4): média das faturas não canceladas criadas no mês.
      const [ticketRow] = await tx
        .select({
          total: sql<number>`coalesce(sum(${faturas.totalCentavos}), 0)::int`,
          n: sql<number>`count(*)::int`,
        })
        .from(faturas)
        .where(and(gte(faturas.createdAt, mes0), ne(faturas.status, 'cancelada')));

      // Faturas a receber (doc 16 D5): saldo em aberto (total − recebido) das
      // faturas não canceladas e não pagas.
      const recebidoExpr = sql<number>`coalesce((select sum(${recebimentos.valorCentavos})
        from ${recebimentos} where ${recebimentos.faturaId} = ${faturas.id}), 0)`;
      const [receberRow] = await tx
        .select({ total: sql<number>`coalesce(sum(${faturas.totalCentavos} - ${recebidoExpr}), 0)::int` })
        .from(faturas)
        .where(and(ne(faturas.status, 'cancelada'), ne(faturas.status, 'paga')));

      const [orcRow] = await tx
        .select({ n: count() })
        .from(orcamentos)
        .where(eq(orcamentos.status, 'aberto'));

      const [clientesRow] = await tx.select({ n: count() }).from(responsaveis);

      const bruto = Number(recebRow?.bruto ?? 0);
      const receitaLiquidaMesCentavos = bruto - Math.round(Number(recebRow?.taxa ?? 0) / 10000);
      const ticketMedioCentavos =
        ticketRow && ticketRow.n > 0 ? Math.round(ticketRow.total / ticketRow.n) : 0;

      return {
        agendaHoje,
        internados: internadosRow?.n ?? 0,
        pendentes: pendentesRow?.n ?? 0,
        faturasAbertas: faturasRow?.n ?? 0,
        receitaLiquidaMesCentavos,
        ticketMedioCentavos,
        aReceberCentavos: Number(receberRow?.total ?? 0),
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
      receitaLiquidaMesCentavos: base.receitaLiquidaMesCentavos,
      ticketMedioCentavos: base.ticketMedioCentavos,
      aReceberCentavos: base.aReceberCentavos,
      orcamentosAbertos: base.orcamentosAbertos,
      clientes: base.clientes,
      minhasComissoesMesCentavos,
    };
  }
}
