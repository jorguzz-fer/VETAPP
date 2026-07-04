import { pgTable, uuid, text, timestamp, integer, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

// Tipos de atendimento (doc 05 §8.5): regras de duração e cor para a agenda.
// Criar usuário já cria agenda / fluxos avançados (doc 05 §3.3) → fase 2.
export const tiposAtendimento = pgTable(
  'tipos_atendimento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    duracaoMinutos: integer('duracao_minutos').notNull().default(30),
    // Cor do evento na agenda (hex, ex.: #7c5cff). Null = cor padrão.
    cor: text('cor'),
    ativo: boolean('ativo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('tipos_atendimento_tenant_idx').on(t.tenantId),
    nomeUniq: uniqueIndex('tipos_atendimento_nome_uniq').on(t.tenantId, t.nome),
  }),
);

export type TipoAtendimento = typeof tiposAtendimento.$inferSelect;
