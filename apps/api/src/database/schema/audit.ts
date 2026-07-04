import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

// Trilha de auditoria (LGPD) — doc 02 §6. Append-only por tenant: quem fez o quê,
// quando, em qual entidade. Escrita nas ações sensíveis (auth, usuários/acessos,
// fiscal, financeiro). Imutabilidade na migração 0023: policies RLS só de SELECT e
// INSERT (sem UPDATE/DELETE → default-deny do RLS bloqueia edição/remoção para
// qualquer papel) + REVOKE UPDATE/DELETE ao usuário da app. Só admin lê (via
// /api/auditoria).
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // Autor da ação. Null = ação de sistema ou usuário já removido (ON DELETE set null).
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    acao: text('acao').notNull(), // ex.: 'auth.login', 'usuario.criar', 'fiscal.emitir'
    entidade: text('entidade').notNull(), // ex.: 'sessao', 'usuario', 'nota_fiscal'
    entidadeId: uuid('entidade_id'), // id do objeto afetado (quando aplicável)
    resumo: text('resumo').notNull(), // linha humana, exibida direto no log
    detalhe: jsonb('detalhe').$type<Record<string, unknown>>(), // contexto estruturado
    ip: text('ip'), // origem da requisição (best-effort)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index('audit_log_tenant_created_idx').on(t.tenantId, t.createdAt),
    tenantEntidadeIdx: index('audit_log_tenant_entidade_idx').on(t.tenantId, t.entidade),
    tenantUserIdx: index('audit_log_tenant_user_idx').on(t.tenantId, t.userId),
  }),
);
