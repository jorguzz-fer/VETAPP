-- Admin da Plataforma (SaaS back-office) — doc 15. Tabelas GLOBAIS (sem tenant/RLS
-- de tenant): o super-admin cruza tenants por natureza. Auth com escopo próprio.
-- `platform_audit_log` é append-only (policies só SELECT/INSERT + REVOKE), mesmo
-- racional do audit_log (blueprint §7). As demais são globais sem RLS (como users).

CREATE TABLE IF NOT EXISTS "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL UNIQUE,
	"nome" text NOT NULL,
	"password_hash" text NOT NULL,
	"mfa_enabled" boolean NOT NULL DEFAULT false,
	"mfa_secret" text,
	"status" text NOT NULL DEFAULT 'active',
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL REFERENCES "platform_admins"("id") ON DELETE cascade,
	"family" uuid NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"revoked_at" timestamptz,
	"replaced_by_id" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_refresh_tokens_admin_idx" ON "platform_refresh_tokens" ("admin_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_refresh_tokens_family_idx" ON "platform_refresh_tokens" ("family");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_mfa_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL REFERENCES "platform_admins"("id") ON DELETE cascade,
	"code_hash" text NOT NULL,
	"used_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_mfa_recovery_codes_admin_idx" ON "platform_mfa_recovery_codes" ("admin_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid REFERENCES "platform_admins"("id") ON DELETE set null,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid,
	"resumo" text NOT NULL,
	"detalhe" jsonb,
	"ip" text,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_audit_log_created_idx" ON "platform_audit_log" ("created_at");
--> statement-breakpoint
-- Append-only por design: só existem policies de SELECT e INSERT (sem tenant, mas
-- com RLS ativo) → sem policy de UPDATE/DELETE, o default-deny do RLS bloqueia
-- edição/remoção para qualquer papel sujeito ao RLS (role-agnóstico).
ALTER TABLE "platform_audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform_audit_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "platform_audit_log_select" ON "platform_audit_log" FOR SELECT USING (true);
--> statement-breakpoint
CREATE POLICY "platform_audit_log_insert" ON "platform_audit_log" FOR INSERT WITH CHECK (true);
--> statement-breakpoint
-- Defesa extra em prod (erro duro): tira UPDATE/DELETE do usuário da app.
DO $$
BEGIN
	IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'vetapp_app') THEN
		REVOKE UPDATE, DELETE ON "platform_audit_log" FROM vetapp_app;
	END IF;
END $$;
