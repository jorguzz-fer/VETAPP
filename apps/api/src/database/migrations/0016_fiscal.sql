-- Fiscal (doc 13 §3): config do emitente + ciclo de vida da nota fiscal.
-- Tenant-scoped com RLS fail-closed (NULLIF — ver 0002). SEM segredos: certificado
-- A1/credenciais do provedor vão para cofre (doc 02), nunca no banco de aplicação.
CREATE TABLE IF NOT EXISTS "fiscal_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cnpj" text,
	"razao_social" text,
	"inscricao_municipal" text,
	"regime_tributario" text DEFAULT 'simples' NOT NULL,
	"serie_nfse" text DEFAULT '1' NOT NULL,
	"proximo_numero" integer DEFAULT 1 NOT NULL,
	"provedor" text DEFAULT 'manual' NOT NULL,
	"ambiente" text DEFAULT 'homologacao' NOT NULL,
	"ativo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fiscal_config" ADD CONSTRAINT "fiscal_config_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fiscal_config_tenant_idx" ON "fiscal_config" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notas_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fatura_id" uuid NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"tipo" text DEFAULT 'nfse' NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"numero" text,
	"serie" text,
	"valor_centavos" integer NOT NULL,
	"provider_ref" text,
	"pdf_key" text,
	"xml_key" text,
	"mensagem" text,
	"emitida_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_fatura_id_fk" FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_responsavel_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."responsaveis"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notas_fiscais_tenant_idx" ON "notas_fiscais" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notas_fiscais_fatura_idx" ON "notas_fiscais" ("tenant_id","fatura_id");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "fiscal_config" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fiscal_config" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "fiscal_config_tenant_isolation" ON "fiscal_config"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "notas_fiscais" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notas_fiscais" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "notas_fiscais_tenant_isolation" ON "notas_fiscais"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
