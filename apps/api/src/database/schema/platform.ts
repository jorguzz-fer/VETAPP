import { pgTable, uuid, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';

// Admin da Plataforma (SaaS back-office) — doc 15. Plano de controle SEPARADO da
// gestão e do tutor: tabelas GLOBAIS (sem tenant/RLS), auth com escopo próprio
// ('platform'). É o único ator que cruza tenants; segurança em dobro (doc 15 §2).

// Identidade do super-admin (dono do SaaS). Bootstrap por seed/ENV, nunca signup.
export const platformAdmins = pgTable('platform_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  nome: text('nome').notNull(),
  passwordHash: text('password_hash').notNull(),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  mfaSecret: text('mfa_secret'),
  status: text('status').notNull().default('active'), // active | disabled
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Refresh stateful do super-admin (rotação + reuso + revogação — igual à gestão).
export const platformRefreshTokens = pgTable(
  'platform_refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(), // = jti
    adminId: uuid('admin_id')
      .notNull()
      .references(() => platformAdmins.id, { onDelete: 'cascade' }),
    family: uuid('family').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    adminIdx: index('platform_refresh_tokens_admin_idx').on(t.adminId),
    familyIdx: index('platform_refresh_tokens_family_idx').on(t.family),
  }),
);

// Recovery codes de MFA do super-admin (uso único; guarda só o hash argon2).
export const platformMfaRecoveryCodes = pgTable(
  'platform_mfa_recovery_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => platformAdmins.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    adminIdx: index('platform_mfa_recovery_codes_admin_idx').on(t.adminId),
  }),
);

// Auditoria própria da plataforma (append-only — doc 15 §2). Separada da auditoria
// de tenant (`audit_log`). Imutabilidade: policies RLS só de SELECT/INSERT (sem
// UPDATE/DELETE → default-deny) + REVOKE ao usuário da app, na migração.
export const platformAuditLog = pgTable(
  'platform_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id').references(() => platformAdmins.id, { onDelete: 'set null' }),
    acao: text('acao').notNull(),
    entidade: text('entidade').notNull(),
    entidadeId: uuid('entidade_id'),
    resumo: text('resumo').notNull(),
    detalhe: jsonb('detalhe').$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index('platform_audit_log_created_idx').on(t.createdAt),
  }),
);

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type PlatformRefreshToken = typeof platformRefreshTokens.$inferSelect;
export type PlatformAuditLogRow = typeof platformAuditLog.$inferSelect;
