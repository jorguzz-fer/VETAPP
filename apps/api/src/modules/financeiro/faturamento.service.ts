import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.service';
import { faturaItens, faturas } from '../../database/schema';

// Faturamento acoplado (doc 04 §3): todo lançamento clínico com valor entra na
// fatura ABERTA do responsável (criada sob demanda). Compartilhado entre
// Prontuário e Internação — sempre dentro da MESMA transação do chamador (tx).
@Injectable()
export class FaturamentoService {
  async faturaAbertaOuNova(tx: Database, tenantId: string, responsavelId: string) {
    const existente = await tx.query.faturas.findFirst({
      where: and(eq(faturas.responsavelId, responsavelId), eq(faturas.status, 'aberta')),
    });
    if (existente) return existente;
    const [nova] = await tx.insert(faturas).values({ tenantId, responsavelId }).returning();
    return nova;
  }

  /**
   * Lança um item na fatura aberta do responsável e atualiza o total.
   * itemId/profissionalId alimentam o comissionamento (doc 05 §5).
   */
  async lancar(
    tx: Database,
    tenantId: string,
    responsavelId: string,
    item: {
      descricao: string;
      valorCentavos: number;
      eventoId?: string | null;
      itemId?: string | null;
      profissionalId?: string | null;
    },
  ): Promise<void> {
    const fatura = await this.faturaAbertaOuNova(tx, tenantId, responsavelId);
    await tx.insert(faturaItens).values({
      tenantId,
      faturaId: fatura.id,
      eventoId: item.eventoId ?? null,
      itemId: item.itemId ?? null,
      profissionalId: item.profissionalId ?? null,
      descricao: item.descricao,
      valorCentavos: item.valorCentavos,
    });
    await tx
      .update(faturas)
      .set({ totalCentavos: sql`${faturas.totalCentavos} + ${item.valorCentavos}`, updatedAt: new Date() })
      .where(eq(faturas.id, fatura.id));
  }
}
