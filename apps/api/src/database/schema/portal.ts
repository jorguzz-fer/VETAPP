import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { responsaveis } from './responsaveis';

// Portal do tutor (doc 13 §5). Credencial de acesso do TUTOR (dono do pet) à área
// logada do cliente. Tutor NUNCA é usuário da gestão — auth totalmente separada.
//
// Tabela GLOBAL (sem RLS), como `users`/`refresh_tokens`: o login roda ANTES de
// haver contexto de tenant. O escopo é garantido em código (todo acesso a dados do
// tutor passa por withTenant(tenantId) + filtro por responsavel_id) e no token
// (scope 'tutor' carrega tenantId + responsavelId). Cada responsável tem no máximo
// uma credencial de portal (unique responsavel_id).
export const tutorCredentials = pgTable(
  'tutor_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    responsavelId: uuid('responsavel_id')
      .notNull()
      .references(() => responsaveis.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // Null enquanto o convite não foi aceito (tutor ainda não definiu senha).
    passwordHash: text('password_hash'),
    // Convite = token de alta entropia enviado pela clínica. Guardamos só o
    // sha256 (token aleatório, não precisa de argon2) para lookup indexado.
    inviteTokenHash: text('invite_token_hash'),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
    // invited → active (convite aceito) → disabled (acesso revogado).
    status: text('status').notNull().default('invited'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    responsavelUnique: uniqueIndex('tutor_credentials_responsavel_unique').on(t.responsavelId),
    tenantEmailIdx: index('tutor_credentials_tenant_email_idx').on(t.tenantId, t.email),
    inviteIdx: index('tutor_credentials_invite_idx').on(t.inviteTokenHash),
  }),
);

export type TutorCredential = typeof tutorCredentials.$inferSelect;
