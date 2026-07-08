-- Histórico/vigência de preços (doc 04 / doc 13 §2): cada linha registra um preço
-- vigente a partir de `vigente_desde`, com quem alterou. Tenant-scoped com RLS
-- fail-closed (padrão NULLIF). O preço atual do item segue em itens_catalogo; aqui
-- fica a trilha de mudanças (o registro mais recente = preço corrente).

CREATE TABLE IF NOT EXISTS "preco_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"item_id" uuid NOT NULL REFERENCES "itens_catalogo"("id") ON DELETE cascade,
	"preco_centavos" integer NOT NULL,
	"vigente_desde" timestamptz DEFAULT now() NOT NULL,
	"alterado_por" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "preco_historico_tenant_idx" ON "preco_historico" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "preco_historico_item_idx" ON "preco_historico" ("tenant_id", "item_id");
--> statement-breakpoint
ALTER TABLE "preco_historico" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "preco_historico" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "preco_historico_tenant_isolation" ON "preco_historico"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
