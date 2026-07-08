-- Mensageria / CRM (doc 17): log de mensagens por canal (WhatsApp/e-mail/SMS/manual),
-- base do histórico por cliente e das campanhas. Tenant-scoped com RLS fail-closed
-- (padrão NULLIF). `disparado_por` referencia o usuário (global). O envio real é
-- provider-agnostic — o driver `log` grava com status `registrada` (envio manual).

CREATE TABLE IF NOT EXISTS "mensagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"responsavel_id" uuid REFERENCES "responsaveis"("id") ON DELETE set null,
	"canal" text NOT NULL,
	"direcao" text NOT NULL DEFAULT 'saida',
	"assunto" text,
	"corpo" text NOT NULL,
	"status" text NOT NULL DEFAULT 'registrada',
	"template_id" uuid,
	"referencia_tipo" text,
	"referencia_id" uuid,
	"disparado_por" uuid,
	"erro" text,
	"enviada_em" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mensagens_tenant_idx" ON "mensagens" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mensagens_responsavel_idx" ON "mensagens" ("tenant_id", "responsavel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mensagens_created_idx" ON "mensagens" ("tenant_id", "created_at");
--> statement-breakpoint
ALTER TABLE "mensagens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mensagens" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mensagens_tenant_isolation" ON "mensagens"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
