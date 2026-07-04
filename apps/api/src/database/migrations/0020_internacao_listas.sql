-- Listas gerenciadas da admissão de internação (doc 05 §9.7): motivos e boxes por
-- tenant, para o modal escolher da lista ou criar na hora. Nome único por tenant
-- (case-insensitive) → não duplica. Tenant-scoped com RLS fail-closed (NULLIF).

CREATE TABLE IF NOT EXISTS "internacao_motivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"nome" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "internacao_motivos_nome_uniq" ON "internacao_motivos" ("tenant_id", lower("nome"));
--> statement-breakpoint
ALTER TABLE "internacao_motivos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "internacao_motivos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "internacao_motivos_tenant_isolation" ON "internacao_motivos"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "internacao_boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"nome" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "internacao_boxes_nome_uniq" ON "internacao_boxes" ("tenant_id", lower("nome"));
--> statement-breakpoint
ALTER TABLE "internacao_boxes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "internacao_boxes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "internacao_boxes_tenant_isolation" ON "internacao_boxes"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
