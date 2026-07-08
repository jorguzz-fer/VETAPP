import { pgTable, uuid, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { animais } from './animais';

// Protocolos vacinais (doc 16 PR9). Tenant-scoped → RLS fail-closed (migração 0034).
// `proximaEm` alimenta o alerta/lembrete de vacina vencendo. `aplicadaPor` é o id do
// usuário que aplicou (tabela global users, sem FK de tenant) — nullable.
export const vacinas = pgTable(
  'vacinas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    animalId: uuid('animal_id').notNull().references(() => animais.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    laboratorio: text('laboratorio'),
    lote: text('lote'),
    aplicadaEm: date('aplicada_em').notNull(),
    proximaEm: date('proxima_em'),
    aplicadaPor: uuid('aplicada_por'),
    observacao: text('observacao'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('vacinas_tenant_idx').on(t.tenantId),
    animalIdx: index('vacinas_animal_idx').on(t.tenantId, t.animalId),
    proximaIdx: index('vacinas_proxima_idx').on(t.tenantId, t.proximaEm),
  }),
);

export type Vacina = typeof vacinas.$inferSelect;
export type NewVacina = typeof vacinas.$inferInsert;
