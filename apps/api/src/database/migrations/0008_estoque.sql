-- Ponto de reposição no catálogo (alerta de estoque mínimo — doc 13 §2).
ALTER TABLE "itens_catalogo" ADD COLUMN IF NOT EXISTS "estoque_minimo" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "estoque_movimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"quantidade" integer NOT NULL,
	"custo_centavos" integer,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estoque_movimentos_tenant_idx" ON "estoque_movimentos" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estoque_movimentos_item_idx" ON "estoque_movimentos" ("tenant_id","item_id");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "estoque_movimentos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "estoque_movimentos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "estoque_movimentos_tenant_isolation" ON "estoque_movimentos"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
