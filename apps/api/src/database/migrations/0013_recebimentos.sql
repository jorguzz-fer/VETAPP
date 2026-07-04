CREATE TABLE IF NOT EXISTS "formas_recebimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"taxa_bps" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "formas_recebimento" ADD CONSTRAINT "formas_recebimento_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "formas_recebimento_tenant_idx" ON "formas_recebimento" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recebimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fatura_id" uuid NOT NULL,
	"forma_id" uuid,
	"valor_centavos" integer NOT NULL,
	"observacao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_fatura_id_fk" FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_forma_id_fk" FOREIGN KEY ("forma_id") REFERENCES "public"."formas_recebimento"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recebimentos_tenant_idx" ON "recebimentos" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recebimentos_fatura_idx" ON "recebimentos" ("tenant_id","fatura_id");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "formas_recebimento" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "formas_recebimento" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "formas_recebimento_tenant_isolation" ON "formas_recebimento"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "recebimentos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recebimentos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "recebimentos_tenant_isolation" ON "recebimentos"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
