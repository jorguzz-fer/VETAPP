import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

// Departamentos da agenda (doc 16 A1): Clínica, Hotel, Banho & Tosa etc. Dimensão
// de organização/visualização da agenda por área. Tenant-scoped → RLS (migração 0035).
export const departamentos = pgTable(
  'departamentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    cor: text('cor'),
    ativo: boolean('ativo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('departamentos_tenant_idx').on(t.tenantId),
    nomeUniq: uniqueIndex('departamentos_nome_uniq').on(t.tenantId, t.nome),
  }),
);

export type Departamento = typeof departamentos.$inferSelect;
