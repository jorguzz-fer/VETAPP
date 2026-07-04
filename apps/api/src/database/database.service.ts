import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import { EnvConfig } from '../config/env';

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Conexão Drizzle usando o usuário da APLICAÇÃO (sem BYPASSRLS).
 *
 * Toda operação escopada a um tenant deve passar por `withTenant`, que abre uma
 * transação e fixa `app.current_tenant`. As políticas RLS (ver migração inicial)
 * usam esse setting, garantindo isolamento mesmo se um filtro for esquecido no
 * código da aplicação (defense-in-depth — docs/spec/03-multitenancy.md).
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly client: postgres.Sql;
  public readonly db: Database;

  constructor(@Inject('ENV') env: EnvConfig) {
    this.client = postgres(env.DATABASE_URL, { max: 10 });
    this.db = drizzle(this.client, { schema });
  }

  /**
   * Executa `fn` dentro de uma transação com o tenant fixado via SET LOCAL.
   * `SET LOCAL` vale apenas para a transação corrente.
   */
  async withTenant<T>(tenantId: string, fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);
      return fn(tx as unknown as Database);
    });
  }

  /**
   * Executa `fn` fixando `app.current_user` (não o tenant). Usado só pelo fluxo de
   * autenticação para ler os vínculos (`memberships`) do próprio usuário ANTES de
   * existir contexto de tenant — a policy `memberships_self_read` (migração 0018)
   * libera apenas as linhas cujo `user_id` casa com esse GUC. Fora do login o GUC
   * nunca é setado, então o isolamento por tenant das demais queries fica intacto.
   */
  async withUser<T>(userId: string, fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_user', ${userId}, true)`);
      return fn(tx as unknown as Database);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
