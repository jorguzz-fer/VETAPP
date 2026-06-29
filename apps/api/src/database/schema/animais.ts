import { pgTable, uuid, text, timestamp, boolean, date, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { responsaveis } from './responsaveis';

// Animal (paciente). Tenant-scoped → RLS. Espécie/raça como texto por enquanto;
// no futuro vêm do catálogo global (Petlove/IA — docs/spec/06).
export const animais = pgTable(
  'animais',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    responsavelId: uuid('responsavel_id')
      .notNull()
      .references(() => responsaveis.id, { onDelete: 'cascade' }),
    codigo: text('codigo'),
    nome: text('nome').notNull(),
    especie: text('especie'),
    raca: text('raca'),
    sexo: text('sexo'), // M | F
    castrado: boolean('castrado').notNull().default(false),
    nascimento: date('nascimento'),
    status: text('status').notNull().default('vivo'), // vivo | falecido
    fotoKey: text('foto_key'), // chave do objeto no storage (R2); leitura via URL assinada
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('animais_tenant_idx').on(t.tenantId),
    responsavelIdx: index('animais_responsavel_idx').on(t.tenantId, t.responsavelId),
  }),
);

export type Animal = typeof animais.$inferSelect;
export type NewAnimal = typeof animais.$inferInsert;
