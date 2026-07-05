import { pgTable, uuid, text, integer, date, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

// Assinaturas do SaaS (doc 15). Tabelas GLOBAIS (o super-admin cruza tenants; a
// gestão só LÊ a própria via login-enforcement). Dinheiro em centavos.

// Catálogo de planos do SaaS (editável pelo super-admin).
export const planos = pgTable('planos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  slug: text('slug').notNull().unique(),
  precoCentavos: integer('preco_centavos').notNull().default(0),
  ciclo: text('ciclo').notNull().default('mensal'), // mensal | anual
  ativo: text('ativo').notNull().default('true'), // 'true' | 'false' (texto p/ simplicidade)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Assinatura corrente de um tenant (uma por clínica). O `status` + as datas mandam
// no acesso (grace period → bloqueio, doc 15 §4.3).
export const assinaturas = pgTable(
  'assinaturas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planoId: uuid('plano_id').references(() => planos.id, { onDelete: 'set null' }),
    // trial | ativa | inadimplente | suspensa | cancelada
    status: text('status').notNull().default('trial'),
    precoCentavos: integer('preco_centavos').notNull().default(0), // snapshot na adesão
    ciclo: text('ciclo').notNull().default('mensal'),
    // Pago até / fim do trial: base do grace period.
    vigenteAte: date('vigente_ate', { mode: 'string' }),
    trialAte: date('trial_ate', { mode: 'string' }),
    canceladaEm: timestamp('cancelada_em', { withTimezone: true }),
    observacao: text('observacao'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantUniq: uniqueIndex('assinaturas_tenant_uniq').on(t.tenantId),
    statusIdx: index('assinaturas_status_idx').on(t.status),
  }),
);

export type Plano = typeof planos.$inferSelect;
export type Assinatura = typeof assinaturas.$inferSelect;
