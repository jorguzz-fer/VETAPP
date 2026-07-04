import { pgTable, uuid, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';
import { itensCatalogo } from './catalogo';

// Comissionamento (doc 05 §5): regra de comissão por colaborador; regra com
// item específico do catálogo SOBREPÕE a regra geral (item_id null).
// Percentual em basis points (10000 = 100%) — inteiro, nunca float.
// A apuração soma fatura_itens com profissional_id no período (sem status de
// pagamento ainda — fechamento/pago → fase 2).
export const comissaoRegras = pgTable(
  'comissao_regras',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    // Null = regra geral do colaborador (vale para qualquer item/lançamento).
    itemId: uuid('item_id').references(() => itensCatalogo.id, { onDelete: 'cascade' }),
    percentBps: integer('percent_bps').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('comissao_regras_tenant_idx').on(t.tenantId),
    userIdx: index('comissao_regras_user_idx').on(t.tenantId, t.userId),
    // Uma regra por (colaborador × item); NULLS NOT DISTINCT não é portátil no
    // drizzle — a unicidade da regra geral (item null) é garantida no service.
    userItemUniq: uniqueIndex('comissao_regras_user_item_uniq').on(t.tenantId, t.userId, t.itemId),
  }),
);

export type ComissaoRegra = typeof comissaoRegras.$inferSelect;
