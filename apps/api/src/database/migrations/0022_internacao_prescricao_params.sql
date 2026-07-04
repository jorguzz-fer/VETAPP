-- Internação fase 2: modelos de prescrição (doc 05 §9.6) + parâmetros clínicos
-- (§9.5). Tudo tenant-scoped com RLS fail-closed (NULLIF).

CREATE TABLE IF NOT EXISTS "modelos_prescricao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"nome" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modelos_prescricao_tenant_idx" ON "modelos_prescricao" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "modelos_prescricao" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "modelos_prescricao" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "modelos_prescricao_tenant_isolation" ON "modelos_prescricao"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "modelos_prescricao_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"modelo_id" uuid NOT NULL REFERENCES "modelos_prescricao"("id") ON DELETE cascade,
	"item_id" uuid REFERENCES "itens_catalogo"("id") ON DELETE set null,
	"descricao" text NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modelos_prescricao_itens_modelo_idx" ON "modelos_prescricao_itens" ("tenant_id", "modelo_id");
--> statement-breakpoint
ALTER TABLE "modelos_prescricao_itens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "modelos_prescricao_itens" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "modelos_prescricao_itens_tenant_isolation" ON "modelos_prescricao_itens"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "internacao_parametros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"internacao_id" uuid NOT NULL REFERENCES "internacoes"("id") ON DELETE cascade,
	"peso_g" integer,
	"temperatura_decimos" integer,
	"freq_cardiaca" integer,
	"freq_respiratoria" integer,
	"observacao" text,
	"registrado_em" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "internacao_parametros_internacao_idx" ON "internacao_parametros" ("tenant_id", "internacao_id");
--> statement-breakpoint
ALTER TABLE "internacao_parametros" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "internacao_parametros" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "internacao_parametros_tenant_isolation" ON "internacao_parametros"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
