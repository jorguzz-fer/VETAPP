-- Rastreio de comissão no faturamento acoplado: quem executou/vendeu e qual
-- item do catálogo originou o lançamento (doc 05 §5).
ALTER TABLE "fatura_itens" ADD COLUMN IF NOT EXISTS "item_id" uuid;
--> statement-breakpoint
ALTER TABLE "fatura_itens" ADD COLUMN IF NOT EXISTS "profissional_id" uuid;
--> statement-breakpoint
ALTER TABLE "fatura_itens" ADD CONSTRAINT "fatura_itens_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fatura_itens" ADD CONSTRAINT "fatura_itens_profissional_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fatura_itens_profissional_idx" ON "fatura_itens" ("tenant_id","profissional_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comissao_regras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid,
	"percent_bps" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comissao_regras" ADD CONSTRAINT "comissao_regras_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "comissao_regras" ADD CONSTRAINT "comissao_regras_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "comissao_regras" ADD CONSTRAINT "comissao_regras_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comissao_regras_tenant_idx" ON "comissao_regras" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comissao_regras_user_idx" ON "comissao_regras" ("tenant_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "comissao_regras_user_item_uniq" ON "comissao_regras" ("tenant_id","user_id","item_id");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "comissao_regras" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "comissao_regras" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "comissao_regras_tenant_isolation" ON "comissao_regras"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
