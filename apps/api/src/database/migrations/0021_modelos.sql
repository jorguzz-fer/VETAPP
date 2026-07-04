-- Modelos de documentos clínicos (doc 05 §8.10/§8.12): receita e documento.
-- Conteúdo com placeholders preenchidos ao gerar. Tenant-scoped com RLS fail-closed.

CREATE TABLE IF NOT EXISTS "modelos_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"tipo" text NOT NULL DEFAULT 'documento',
	"nome" text NOT NULL,
	"conteudo" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modelos_documento_tenant_idx" ON "modelos_documento" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modelos_documento_tipo_idx" ON "modelos_documento" ("tenant_id", "tipo");
--> statement-breakpoint
ALTER TABLE "modelos_documento" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "modelos_documento" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "modelos_documento_tenant_isolation" ON "modelos_documento"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
