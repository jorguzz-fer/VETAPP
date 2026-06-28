import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { animais } from './animais';
import { responsaveis } from './responsaveis';
import { users } from './users';

// Agendamento da agenda operacional (docs/spec/05 §3). Tenant-scoped → RLS.
export const agendamentos = pgTable(
  'agendamentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    profissionalId: uuid('profissional_id').references(() => users.id, { onDelete: 'set null' }),
    animalId: uuid('animal_id').references(() => animais.id, { onDelete: 'set null' }),
    responsavelId: uuid('responsavel_id').references(() => responsaveis.id, { onDelete: 'set null' }),
    titulo: text('titulo').notNull(),
    inicio: timestamp('inicio', { withTimezone: true }).notNull(),
    fim: timestamp('fim', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('agendado'), // agendado | concluido | cancelado
    observacoes: text('observacoes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('agendamentos_tenant_idx').on(t.tenantId),
    inicioIdx: index('agendamentos_inicio_idx').on(t.tenantId, t.inicio),
  }),
);

export type Agendamento = typeof agendamentos.$inferSelect;
