import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Tenant = clínica. Tabela "global" (não carrega tenant_id próprio).
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  document: text('document'), // CNPJ/CPF
  status: text('status').notNull().default('active'), // active | suspended | closed
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
