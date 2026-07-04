import { Injectable } from '@nestjs/common';
import { and, count, eq, gte, isNotNull, lte, sum } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { agendamentos, faturaItens, users } from '../../database/schema';
import type { ProdutividadeDto } from './inteligencia.dto';

// Inteligência fase 1 (doc 05 §6.1): produtividade por colaborador — receita
// gerada (fatura_itens com profissional) + agendamentos concluídos no período.
// Agrupamento por setor e analytics de vendas unificado (6.2) → fase 2.
@Injectable()
export class InteligenciaService {
  constructor(private readonly database: DatabaseService) {}

  async produtividade(tenantId: string, from?: string, to?: string): Promise<ProdutividadeDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const receitaConds = [isNotNull(faturaItens.profissionalId)];
      if (from) receitaConds.push(gte(faturaItens.createdAt, new Date(from)));
      if (to) receitaConds.push(lte(faturaItens.createdAt, new Date(to)));

      const receita = await tx
        .select({
          userId: faturaItens.profissionalId,
          nome: users.name,
          lancamentos: count(),
          receita: sum(faturaItens.valorCentavos),
        })
        .from(faturaItens)
        .innerJoin(users, eq(users.id, faturaItens.profissionalId))
        .where(and(...receitaConds))
        .groupBy(faturaItens.profissionalId, users.name);

      const agendaConds = [isNotNull(agendamentos.profissionalId), eq(agendamentos.status, 'concluido')];
      if (from) agendaConds.push(gte(agendamentos.inicio, new Date(from)));
      if (to) agendaConds.push(lte(agendamentos.inicio, new Date(to)));

      const concluidos = await tx
        .select({
          userId: agendamentos.profissionalId,
          nome: users.name,
          n: count(),
        })
        .from(agendamentos)
        .innerJoin(users, eq(users.id, agendamentos.profissionalId))
        .where(and(...agendaConds))
        .groupBy(agendamentos.profissionalId, users.name);

      const porUser = new Map<string, ProdutividadeDto>();
      for (const r of receita) {
        porUser.set(r.userId!, {
          userId: r.userId!,
          nome: r.nome,
          lancamentos: r.lancamentos,
          receitaCentavos: Number(r.receita ?? 0),
          agendamentosConcluidos: 0,
        });
      }
      for (const c of concluidos) {
        const atual = porUser.get(c.userId!) ?? {
          userId: c.userId!,
          nome: c.nome,
          lancamentos: 0,
          receitaCentavos: 0,
          agendamentosConcluidos: 0,
        };
        atual.agendamentosConcluidos = c.n;
        porUser.set(c.userId!, atual);
      }
      return [...porUser.values()].sort((a, b) => b.receitaCentavos - a.receitaCentavos);
    });
  }
}
