import { pgTable, uuid, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { responsaveis } from './responsaveis';
import { faturas } from './prontuario';

// Fiscal (doc 13 §3). Emissão de documentos fiscais a partir de faturas. A
// integração com o PROVEDOR fiscal (Focus NFe/NFe.io/PlugNotas/SEFAZ/prefeitura)
// é pluggável — ver FiscalProvider. Config e ciclo da nota são provider-agnostic.

// Configuração fiscal do tenant (emitente). Um registro por tenant. Tenant-scoped
// → RLS. SEM segredos aqui: certificado A1/credenciais do provedor vão para cofre
// (doc 02), nunca no banco de aplicação/repo.
export const fiscalConfig = pgTable(
  'fiscal_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    cnpj: text('cnpj'),
    razaoSocial: text('razao_social'),
    inscricaoMunicipal: text('inscricao_municipal'),
    // simples | presumido | real
    regimeTributario: text('regime_tributario').notNull().default('simples'),
    // Série e próximo número da NFS-e (numeração própria no modo manual).
    serieNfse: text('serie_nfse').notNull().default('1'),
    proximoNumero: integer('proximo_numero').notNull().default(1),
    // manual | focus | nfe_io | plugnotas — provedor de emissão (default: manual).
    provedor: text('provedor').notNull().default('manual'),
    // homologacao | producao
    ambiente: text('ambiente').notNull().default('homologacao'),
    ativo: boolean('ativo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('fiscal_config_tenant_idx').on(t.tenantId),
  }),
);

// Nota fiscal: ciclo de vida vinculado a uma fatura. Tenant-scoped → RLS.
export const notasFiscais = pgTable(
  'notas_fiscais',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    faturaId: uuid('fatura_id').notNull().references(() => faturas.id, { onDelete: 'cascade' }),
    responsavelId: uuid('responsavel_id').notNull().references(() => responsaveis.id, { onDelete: 'cascade' }),
    // nfse (serviço) | nfe (produto) — nesta fase focamos NFS-e.
    tipo: text('tipo').notNull().default('nfse'),
    // rascunho | processando | emitida | rejeitada | cancelada
    status: text('status').notNull().default('rascunho'),
    numero: text('numero'),
    serie: text('serie'),
    valorCentavos: integer('valor_centavos').notNull(),
    // Referência externa no provedor (id do documento) + chaves de PDF/XML no storage.
    providerRef: text('provider_ref'),
    pdfKey: text('pdf_key'),
    xmlKey: text('xml_key'),
    // Mensagem do provedor (rejeição) ou motivo de cancelamento.
    mensagem: text('mensagem'),
    emitidaEm: timestamp('emitida_em', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('notas_fiscais_tenant_idx').on(t.tenantId),
    faturaIdx: index('notas_fiscais_fatura_idx').on(t.tenantId, t.faturaId),
  }),
);

export type FiscalConfig = typeof fiscalConfig.$inferSelect;
export type NotaFiscal = typeof notasFiscais.$inferSelect;
