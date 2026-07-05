import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { platformAuditLog } from '../../database/schema';

export interface PlatformAuditEntry {
  adminId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  resumo: string;
  detalhe?: Record<string, unknown> | null;
  ip?: string | null;
}

// Auditoria da plataforma (doc 15 §2). Append-only (migração 0030). Best-effort:
// falha aqui nunca quebra a ação. Tabela global — sem contexto de tenant.
@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(private readonly database: DatabaseService) {}

  async registrar(entry: PlatformAuditEntry): Promise<void> {
    try {
      await this.database.db.insert(platformAuditLog).values({
        adminId: entry.adminId ?? null,
        acao: entry.acao,
        entidade: entry.entidade,
        entidadeId: entry.entidadeId ?? null,
        resumo: entry.resumo,
        detalhe: entry.detalhe ?? null,
        ip: entry.ip ?? null,
      });
    } catch (err) {
      this.logger.error(`Falha ao registrar auditoria da plataforma (${entry.acao}): ${(err as Error).message}`);
    }
  }
}
