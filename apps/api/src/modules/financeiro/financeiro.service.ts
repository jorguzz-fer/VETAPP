import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { faturaItens, faturas, responsaveis } from '../../database/schema';
import type { FaturaResumoDto, OkDto } from './financeiro.dto';

// Financeiro fase 1: listar faturas do tenant e dar baixa (receber).
// Formas de recebimento/recebimentos parciais ficam para a fase 2 (doc 13 §1).
@Injectable()
export class FinanceiroService {
  constructor(private readonly database: DatabaseService) {}

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

  /** Baixa a fatura (recebimento integral). */
  async pagar(tenantId: string, id: string): Promise<OkDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const fatura = await tx.query.faturas.findFirst({ where: eq(faturas.id, id) });
      if (!fatura) throw new NotFoundException('Fatura não encontrada');
      if (fatura.status !== 'aberta') throw new BadRequestException('Fatura não está aberta');
      await tx.update(faturas).set({ status: 'paga', updatedAt: new Date() }).where(eq(faturas.id, id));
      return { ok: true };
    });
  }
}
