import { Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { auditLog, users } from '../../database/schema';
import type { AuditLogItemDto, AuditLogPageDto } from './audit.dto';

/** Uma entrada de auditoria. `tenantId` é passado à parte (contexto RLS). */
export interface AuditEntry {
  userId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  resumo: string;
  detalhe?: Record<string, unknown> | null;
  ip?: string | null;
}

export interface AuditFiltro {
  entidade?: string;
  acao?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

// Trilha de auditoria (LGPD) — doc 02 §6. `registrar` é best-effort: uma falha
// aqui NUNCA quebra a ação de negócio (só loga). A tabela é append-only (RLS +
// REVOKE UPDATE/DELETE na migração 0023); a leitura é restrita a admin (controller).
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly database: DatabaseService) {}

  /** Grava uma entrada sob o contexto de tenant (RLS). Nunca lança. */
  async registrar(tenantId: string, entry: AuditEntry): Promise<void> {
    try {
      await this.database.withTenant(tenantId, (tx) =>
        tx.insert(auditLog).values({
          tenantId,
          userId: entry.userId ?? null,
          acao: entry.acao,
          entidade: entry.entidade,
          entidadeId: entry.entidadeId ?? null,
          resumo: entry.resumo,
          detalhe: entry.detalhe ?? null,
          ip: entry.ip ?? null,
        }),
      );
    } catch (err) {
      this.logger.error(`Falha ao registrar auditoria (${entry.acao}): ${(err as Error).message}`);
    }
  }

  /** Consulta paginada do log do tenant (admin). Mais recente primeiro. */
  async list(tenantId: string, filtro: AuditFiltro): Promise<AuditLogPageDto> {
    const limit = Math.min(Math.max(filtro.limit ?? 50, 1), 200);
    const offset = Math.max(filtro.offset ?? 0, 0);

    const conds = [eq(auditLog.tenantId, tenantId)];
    if (filtro.entidade) conds.push(eq(auditLog.entidade, filtro.entidade));
    if (filtro.acao) conds.push(eq(auditLog.acao, filtro.acao));
    if (filtro.userId) conds.push(eq(auditLog.userId, filtro.userId));
    const where = and(...conds);

    return this.database.withTenant(tenantId, async (tx) => {
      const [{ total }] = await tx.select({ total: count() }).from(auditLog).where(where);
      const rows = await tx
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset);

      // Nomes dos autores (users é global): busca fora do escopo de tenant.
      const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))];
      const nomes = new Map<string, string>();
      if (userIds.length > 0) {
        const us = await this.database.db.query.users.findMany({ where: inArray(users.id, userIds) });
        for (const u of us) nomes.set(u.id, u.name);
      }

      const items: AuditLogItemDto[] = rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userNome: r.userId ? nomes.get(r.userId) ?? null : null,
        acao: r.acao,
        entidade: r.entidade,
        entidadeId: r.entidadeId,
        resumo: r.resumo,
        detalhe: r.detalhe ?? null,
        ip: r.ip,
        criadoEm: r.createdAt.toISOString(),
      }));

      return { items, total: Number(total), limit, offset };
    });
  }
}
