-- Branding do tenant (logo da clínica) — usado no app e nos documentos impressos.
-- Tabela de domínio: tenant-scoped com RLS fail-closed (padrão NULLIF). Uma linha
-- por tenant (índice único). O logo em si vai para o R2 (bucket privado); aqui só
-- fica a `logo_key` — leitura sempre por URL assinada.

CREATE TABLE IF NOT EXISTS "tenant_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"logo_key" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_branding_tenant_uniq" ON "tenant_branding" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "tenant_branding" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_branding" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_branding_tenant_isolation" ON "tenant_branding"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
