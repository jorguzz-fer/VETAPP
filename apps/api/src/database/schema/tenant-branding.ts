import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

// Branding do tenant (logo da clínica) — reaproveitado no app (cabeçalho) e nos
// documentos impressos/2ª via. Diferente do `site_config` (logo do site público,
// tabela global lida por slug): o branding NÃO é público, então é tabela de domínio
// com RLS fail-closed (convenção #1). Uma linha por tenant.
export const tenantBranding = pgTable(
  'tenant_branding',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // Key do objeto no R2 (bucket privado); acesso só por URL assinada. Null = sem logo.
    logoKey: text('logo_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantUniq: uniqueIndex('tenant_branding_tenant_uniq').on(t.tenantId),
  }),
);
