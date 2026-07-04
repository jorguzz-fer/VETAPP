-- Trilha de auditoria (LGPD) — doc 02 §6. Tabela append-only por tenant: registra
-- ações sensíveis (auth, usuários/acessos, fiscal, financeiro). Tenant-scoped com
-- RLS fail-closed (padrão NULLIF). Imutabilidade garantida por REVOKE UPDATE/DELETE
-- ao usuário da aplicação (vetapp_app) — só INSERT e SELECT; nem a app apaga/edita.

CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"user_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid,
	"resumo" text NOT NULL,
	"detalhe" jsonb,
	"ip" text,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_tenant_created_idx" ON "audit_log" ("tenant_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_tenant_entidade_idx" ON "audit_log" ("tenant_id", "entidade");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_tenant_user_idx" ON "audit_log" ("tenant_id", "user_id");
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Append-only por design: existem policies APENAS para SELECT e INSERT (isolamento
-- por tenant, padrão NULLIF fail-closed). Como não há policy de UPDATE nem DELETE e
-- o RLS é default-deny, QUALQUER papel sujeito ao RLS afeta zero linhas ao tentar
-- editar/apagar — a imutabilidade não depende de grants. Role-agnóstico (vale para
-- vetapp_app em prod e para o app_role dos testes).
CREATE POLICY "audit_log_tenant_select" ON "audit_log"
	FOR SELECT
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "audit_log_tenant_insert" ON "audit_log"
	FOR INSERT
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
-- Defesa extra (erro DURO, não silencioso) para o usuário da aplicação em prod: sem
-- privilégio de UPDATE/DELETE. O ALTER DEFAULT PRIVILEGES concede SIUD por padrão —
-- aqui retiramos U e D. Guardado por checagem de existência do papel (dev/CI).
DO $$
BEGIN
	IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'vetapp_app') THEN
		REVOKE UPDATE, DELETE ON "audit_log" FROM vetapp_app;
	END IF;
END $$;
