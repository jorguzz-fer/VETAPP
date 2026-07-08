import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { responsaveis } from './responsaveis';

// Mensageria / CRM (doc 17). Tenant-scoped → RLS fail-closed (migração 0037). Log de
// mensagens por canal; base do histórico por cliente. `disparadoPor` = usuário (global).
export const mensagens = pgTable(
  'mensagens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    responsavelId: uuid('responsavel_id').references(() => responsaveis.id, { onDelete: 'set null' }),
    canal: text('canal').notNull(), // whatsapp | email | sms | manual
    direcao: text('direcao').notNull().default('saida'), // saida (entrada = futuro)
    assunto: text('assunto'),
    corpo: text('corpo').notNull(),
    // registrada | enviada | entregue | visualizada | clicada | falha
    status: text('status').notNull().default('registrada'),
    templateId: uuid('template_id'),
    referenciaTipo: text('referencia_tipo'), // ex.: vacina | agendamento
    referenciaId: uuid('referencia_id'),
    disparadoPor: uuid('disparado_por'),
    erro: text('erro'),
    enviadaEm: timestamp('enviada_em', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('mensagens_tenant_idx').on(t.tenantId),
    responsavelIdx: index('mensagens_responsavel_idx').on(t.tenantId, t.responsavelId),
    createdIdx: index('mensagens_created_idx').on(t.tenantId, t.createdAt),
  }),
);

export type Mensagem = typeof mensagens.$inferSelect;
