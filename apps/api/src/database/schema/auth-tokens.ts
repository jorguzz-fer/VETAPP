import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tutorCredentials } from './portal';

// Tabelas de infraestrutura de AUTH — globais (não tenant-scoped, como `users`).
// Não têm RLS: são acessadas pelo fluxo de auth ANTES de haver contexto de
// tenant; o escopo é por jti/userId no código. Segurança fase 2 (doc 02 §2.2).

// Refresh tokens com rotação: cada refresh emite um novo jti na MESMA family e
// revoga o anterior. Apresentar um jti já revogado = reuso → revoga a family
// inteira (mitigação de roubo de token). O JWT carrega só o jti + family.
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(), // = jti do refresh JWT
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    role: text('role').notNull(),
    family: uuid('family').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('refresh_tokens_user_idx').on(t.userId),
    familyIdx: index('refresh_tokens_family_idx').on(t.family),
  }),
);

// Recovery codes do MFA: 10 códigos de uso único (guardados só o hash argon2).
export const mfaRecoveryCodes = pgTable(
  'mfa_recovery_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('mfa_recovery_codes_user_idx').on(t.userId),
  }),
);

// Refresh tokens do PORTAL DO TUTOR — mesmo padrão stateful da gestão (rotação por
// family + detecção de reuso + revogação), mas escopado por credencial do tutor.
// Global/sem RLS (auth do tutor é separada da gestão; escopo por jti/credentialId).
export const tutorRefreshTokens = pgTable(
  'tutor_refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(), // = jti do refresh JWT do tutor
    credentialId: uuid('credential_id')
      .notNull()
      .references(() => tutorCredentials.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    responsavelId: uuid('responsavel_id').notNull(),
    family: uuid('family').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    credentialIdx: index('tutor_refresh_tokens_credential_idx').on(t.credentialId),
    familyIdx: index('tutor_refresh_tokens_family_idx').on(t.family),
  }),
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type MfaRecoveryCode = typeof mfaRecoveryCodes.$inferSelect;
export type TutorRefreshToken = typeof tutorRefreshTokens.$inferSelect;
