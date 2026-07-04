import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

// Site público da clínica (doc 13 §4). Presença institucional por tenant +
// solicitação de agendamento (única escrita pública — a clínica confirma).

// Config do site: conteúdo PÚBLICO (CMS-lite). Tabela GLOBAL (sem RLS): a leitura
// pública é por `slug` (URL), ANTES de haver contexto de tenant — mesmo racional
// de `users`. A edição é sempre filtrada por tenant_id (= req.auth) no código.
// Conteúdo é público por design; nada sensível mora aqui.
export const siteConfig = pgTable(
  'site_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    // Slug da URL pública (/clinica/<slug>). Único globalmente.
    slug: text('slug').notNull(),
    publicado: boolean('publicado').notNull().default(false),
    nomeExibicao: text('nome_exibicao'),
    sobre: text('sobre'),
    // Serviços em destaque, um por linha (texto livre nesta fase).
    servicos: text('servicos'),
    endereco: text('endereco'),
    telefone: text('telefone'),
    whatsapp: text('whatsapp'),
    email: text('email'),
    horario: text('horario'),
    corPrimaria: text('cor_primaria'),
    logoKey: text('logo_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantUnique: uniqueIndex('site_config_tenant_unique').on(t.tenantId),
    slugUnique: uniqueIndex('site_config_slug_unique').on(t.slug),
  }),
);

// Solicitação de agendamento vinda do site público. Contém PII do visitante →
// dado da clínica, tenant-scoped com RLS. A recepção confirma/recusa; a criação
// do agendamento real segue o fluxo interno (o visitante ainda não é cliente).
export const agendamentoSolicitacoes = pgTable(
  'agendamento_solicitacoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    telefone: text('telefone').notNull(),
    email: text('email'),
    petNome: text('pet_nome'),
    servicoDesejado: text('servico_desejado'),
    preferencia: text('preferencia'),
    mensagem: text('mensagem'),
    // "Como nos conheceu?" — alimenta a origem do cliente no cadastro (doc 05 §8.11).
    origem: text('origem'),
    // nova | confirmada | recusada
    status: text('status').notNull().default('nova'),
    observacaoInterna: text('observacao_interna'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('agendamento_solicitacoes_tenant_idx').on(t.tenantId),
    statusIdx: index('agendamento_solicitacoes_status_idx').on(t.tenantId, t.status),
  }),
);

export type SiteConfig = typeof siteConfig.$inferSelect;
export type AgendamentoSolicitacao = typeof agendamentoSolicitacoes.$inferSelect;
