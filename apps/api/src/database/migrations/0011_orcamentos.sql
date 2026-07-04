CREATE TABLE IF NOT EXISTS "orcamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_responsavel_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."responsaveis"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orcamentos_tenant_idx" ON "orcamentos" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orcamentos_responsavel_idx" ON "orcamentos" ("tenant_id","responsavel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orcamentos_status_idx" ON "orcamentos" ("tenant_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orcamento_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"orcamento_id" uuid NOT NULL,
	"item_id" uuid,
	"descricao" text NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"valor_centavos" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_orcamento_id_fk" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamentos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orcamento_itens_tenant_idx" ON "orcamento_itens" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orcamento_itens_orcamento_idx" ON "orcamento_itens" ("tenant_id","orcamento_id");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "orcamentos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orcamentos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "orcamentos_tenant_isolation" ON "orcamentos"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "orcamento_itens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orcamento_itens" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "orcamento_itens_tenant_isolation" ON "orcamento_itens"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
