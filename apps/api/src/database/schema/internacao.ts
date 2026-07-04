import { pgTable, uuid, text, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { animais } from './animais';
import { itensCatalogo } from './catalogo';

// Internação fase 1 (doc 05 §9): admissão explícita, mapa de execução mínimo e
// alta. Executar uma prescrição = baixa de estoque + faturamento automático.
// TV/tablet por box, parâmetros clínicos e modelos de prescrição → fase 2.
export const internacoes = pgTable(
  'internacoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    animalId: uuid('animal_id').notNull().references(() => animais.id, { onDelete: 'cascade' }),
    motivo: text('motivo').notNull(),
    box: text('box'),
    status: text('status').notNull().default('internado'), // internado | alta
    entradaEm: timestamp('entrada_em', { withTimezone: true }).notNull().defaultNow(),
    altaEm: timestamp('alta_em', { withTimezone: true }),
    observacoes: text('observacoes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('internacoes_tenant_idx').on(t.tenantId),
    statusIdx: index('internacoes_status_idx').on(t.tenantId, t.status),
    animalIdx: index('internacoes_animal_idx').on(t.tenantId, t.animalId),
  }),
);

// Prescrição/execução: linha do mapa de execução. `executadaEm` null = pendente.
export const internacaoExecucoes = pgTable(
  'internacao_execucoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    internacaoId: uuid('internacao_id').notNull().references(() => internacoes.id, { onDelete: 'cascade' }),
    // Item do catálogo (medicamento/procedimento). Null = lançamento livre.
    itemId: uuid('item_id').references(() => itensCatalogo.id, { onDelete: 'set null' }),
    descricao: text('descricao').notNull(),
    quantidade: integer('quantidade').notNull().default(1),
    // Valor unitário em centavos; null = sem faturamento.
    valorCentavos: integer('valor_centavos'),
    executadaEm: timestamp('executada_em', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('internacao_execucoes_tenant_idx').on(t.tenantId),
    internacaoIdx: index('internacao_execucoes_internacao_idx').on(t.tenantId, t.internacaoId),
  }),
);

// Listas gerenciadas por tenant para a admissão (doc 05 §9.7 boxes). Nome único
// por tenant (case-insensitive) → não duplica. Tenant-scoped → RLS.
export const internacaoMotivos = pgTable(
  'internacao_motivos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nomeUniq: uniqueIndex('internacao_motivos_nome_uniq').on(t.tenantId, sql`lower(${t.nome})`),
  }),
);

export const internacaoBoxes = pgTable(
  'internacao_boxes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nomeUniq: uniqueIndex('internacao_boxes_nome_uniq').on(t.tenantId, sql`lower(${t.nome})`),
  }),
);

export type Internacao = typeof internacoes.$inferSelect;
export type InternacaoExecucao = typeof internacaoExecucoes.$inferSelect;
export type InternacaoMotivo = typeof internacaoMotivos.$inferSelect;
export type InternacaoBox = typeof internacaoBoxes.$inferSelect;
