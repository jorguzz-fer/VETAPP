import { pgTable, uuid, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { faturas } from './prontuario';

// Financeiro fase 2 (doc 13 §1). Formas de recebimento = cadastro de apoio
// (dinheiro/Pix/cartão/transferência) com taxa opcional em basis points.
export const formasRecebimento = pgTable(
  'formas_recebimento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    tipo: text('tipo').notNull(), // dinheiro | pix | cartao_credito | cartao_debito | transferencia | outro
    // Taxa da adquirente em basis points (2,5% = 250). 0 = sem taxa.
    taxaBps: integer('taxa_bps').notNull().default(0),
    ativo: boolean('ativo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('formas_recebimento_tenant_idx').on(t.tenantId),
  }),
);

// Recebimento (baixa) de fatura — permite pagamento PARCIAL: a soma dos
// recebimentos vs. total da fatura define o status (aberta/parcial/paga).
export const recebimentos = pgTable(
  'recebimentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    faturaId: uuid('fatura_id').notNull().references(() => faturas.id, { onDelete: 'cascade' }),
    formaId: uuid('forma_id').references(() => formasRecebimento.id, { onDelete: 'set null' }),
    valorCentavos: integer('valor_centavos').notNull(),
    observacao: text('observacao'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('recebimentos_tenant_idx').on(t.tenantId),
    faturaIdx: index('recebimentos_fatura_idx').on(t.tenantId, t.faturaId),
  }),
);

export type FormaRecebimento = typeof formasRecebimento.$inferSelect;
export type Recebimento = typeof recebimentos.$inferSelect;
