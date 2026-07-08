import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

// Modelos de documentos clínicos (doc 05 §8.10/§8.12): receita e documento
// (termo, contrato, check-in/out). Conteúdo com placeholders ({{animal}},
// {{tutor}}, {{data}}, {{clinica}}…) preenchidos ao gerar a partir da ficha.
// Tenant-scoped → RLS.
export const modelosDocumento = pgTable(
  'modelos_documento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    // receita | documento
    tipo: text('tipo').notNull().default('documento'),
    nome: text('nome').notNull(),
    conteudo: text('conteudo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('modelos_documento_tenant_idx').on(t.tenantId),
    tipoIdx: index('modelos_documento_tipo_idx').on(t.tenantId, t.tipo),
  }),
);

export type ModeloDocumento = typeof modelosDocumento.$inferSelect;
