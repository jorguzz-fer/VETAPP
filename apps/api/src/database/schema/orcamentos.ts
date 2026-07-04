import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { responsaveis } from './responsaveis';
import { itensCatalogo } from './catalogo';

// Orçamento (doc 05 §4.11/§2.2): acoplado à ficha do cliente, itens por código
// do catálogo. Aprovar não fatura; CONVERTER lança tudo na fatura aberta do
// responsável. Modelos de orçamento/pacotes prontos → fase 2.
export const orcamentos = pgTable(
  'orcamentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    responsavelId: uuid('responsavel_id').notNull().references(() => responsaveis.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('aberto'), // aberto | aprovado | recusado | convertido
    observacoes: text('observacoes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('orcamentos_tenant_idx').on(t.tenantId),
    responsavelIdx: index('orcamentos_responsavel_idx').on(t.tenantId, t.responsavelId),
    statusIdx: index('orcamentos_status_idx').on(t.tenantId, t.status),
  }),
);

export const orcamentoItens = pgTable(
  'orcamento_itens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    orcamentoId: uuid('orcamento_id').notNull().references(() => orcamentos.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => itensCatalogo.id, { onDelete: 'set null' }),
    descricao: text('descricao').notNull(),
    quantidade: integer('quantidade').notNull().default(1),
    // Valor unitário em centavos (congelado no momento da inclusão).
    valorCentavos: integer('valor_centavos').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('orcamento_itens_tenant_idx').on(t.tenantId),
    orcamentoIdx: index('orcamento_itens_orcamento_idx').on(t.tenantId, t.orcamentoId),
  }),
);

export type Orcamento = typeof orcamentos.$inferSelect;
export type OrcamentoItem = typeof orcamentoItens.$inferSelect;
