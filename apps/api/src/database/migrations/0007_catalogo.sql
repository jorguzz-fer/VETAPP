CREATE TABLE IF NOT EXISTS "itens_catalogo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"preco_centavos" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itens_catalogo_tenant_idx" ON "itens_catalogo" ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "itens_catalogo_codigo_uniq" ON "itens_catalogo" ("tenant_id","codigo");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itens_catalogo_nome_idx" ON "itens_catalogo" ("tenant_id","nome");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "itens_catalogo" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "itens_catalogo" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "itens_catalogo_tenant_isolation" ON "itens_catalogo"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
