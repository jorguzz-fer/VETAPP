import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { itensCatalogo } from './catalogo';

// Histórico/vigência de preços (doc 04 / doc 13 §2): cada linha é um preço vigente
// A PARTIR de `vigenteDesde`. O preço atual do item é o registro mais recente; o
// histórico mostra quem mudou, quando e o valor. Tenant-scoped com RLS fail-closed.
export const precoHistorico = pgTable(
  'preco_historico',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull().references(() => itensCatalogo.id, { onDelete: 'cascade' }),
    precoCentavos: integer('preco_centavos').notNull(),
    vigenteDesde: timestamp('vigente_desde', { withTimezone: true }).notNull().defaultNow(),
    // Quem alterou (opcional; null = criação/seed/sistema). FK lógica a users.
    alteradoPor: uuid('alterado_por'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('preco_historico_tenant_idx').on(t.tenantId),
    itemIdx: index('preco_historico_item_idx').on(t.tenantId, t.itemId),
  }),
);

export type PrecoHistorico = typeof precoHistorico.$inferSelect;
