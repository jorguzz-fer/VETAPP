import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { animais } from './animais';
import { responsaveis } from './responsaveis';

// Evento de prontuário: alimenta a linha do tempo da vida do animal (doc 05 §2.3).
export const prontuarioEventos = pgTable(
  'prontuario_eventos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    animalId: uuid('animal_id').notNull().references(() => animais.id, { onDelete: 'cascade' }),
    tipo: text('tipo').notNull(), // atendimento | peso | vacina | exame | receita | observacao | internacao
    descricao: text('descricao').notNull(),
    // Dinheiro em centavos (inteiro) — evita float (blueprint §10). Null = sem faturamento.
    valorCentavos: integer('valor_centavos'),
    data: timestamp('data', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('prontuario_eventos_tenant_idx').on(t.tenantId),
    animalIdx: index('prontuario_eventos_animal_idx').on(t.tenantId, t.animalId),
  }),
);

// Fatura do responsável: consolida lançamentos do clínico (faturamento acoplado, doc 04 §3).
export const faturas = pgTable(
  'faturas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    responsavelId: uuid('responsavel_id').notNull().references(() => responsaveis.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('aberta'), // aberta | paga | cancelada
    totalCentavos: integer('total_centavos').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('faturas_tenant_idx').on(t.tenantId),
    responsavelIdx: index('faturas_responsavel_idx').on(t.tenantId, t.responsavelId),
  }),
);

export const faturaItens = pgTable(
  'fatura_itens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    faturaId: uuid('fatura_id').notNull().references(() => faturas.id, { onDelete: 'cascade' }),
    eventoId: uuid('evento_id').references(() => prontuarioEventos.id, { onDelete: 'set null' }),
    descricao: text('descricao').notNull(),
    valorCentavos: integer('valor_centavos').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('fatura_itens_tenant_idx').on(t.tenantId),
    faturaIdx: index('fatura_itens_fatura_idx').on(t.tenantId, t.faturaId),
  }),
);

export type ProntuarioEvento = typeof prontuarioEventos.$inferSelect;
export type Fatura = typeof faturas.$inferSelect;
export type FaturaItem = typeof faturaItens.$inferSelect;
