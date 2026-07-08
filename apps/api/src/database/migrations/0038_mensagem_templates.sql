-- Templates de mensagem (doc 17 slice 2): modelos reutilizáveis por canal, com
-- placeholders (ex.: {{cliente}}, {{pet}}, {{vacina}}, {{data}}). Tenant-scoped com
-- RLS fail-closed (padrão NULLIF). `mensagens.template_id` já existe (0037) e passa a
-- referenciar esta tabela logicamente (sem FK dura, para não travar histórico antigo).

CREATE TABLE IF NOT EXISTS "mensagem_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"nome" text NOT NULL,
	"canal" text NOT NULL,
	"assunto" text,
	"corpo" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mensagem_templates_tenant_idx" ON "mensagem_templates" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "mensagem_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mensagem_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mensagem_templates_tenant_isolation" ON "mensagem_templates"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
