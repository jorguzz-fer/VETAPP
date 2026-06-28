import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

// Responsável = tutor/dono do animal (o "cliente" comercial). Tenant-scoped → RLS.
export const responsaveis = pgTable(
  'responsaveis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    codigo: text('codigo'),
    nome: text('nome').notNull(),
    email: text('email'),
    telefone: text('telefone'),
    documento: text('documento'), // CPF/CNPJ
    // "Como nos conheceu?" — origem capturada no cadastro (docs/spec/05 §2.2/8.11)
    origem: text('origem'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('responsaveis_tenant_idx').on(t.tenantId),
    nomeIdx: index('responsaveis_nome_idx').on(t.tenantId, t.nome),
  }),
);

export type Responsavel = typeof responsaveis.$inferSelect;
export type NewResponsavel = typeof responsaveis.$inferInsert;
