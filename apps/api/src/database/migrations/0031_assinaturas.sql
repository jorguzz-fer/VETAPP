-- Assinaturas do SaaS (doc 15, Stage 2). Tabelas GLOBAIS (sem RLS de tenant): o
-- super-admin cruza tenants; a gestão só lê a própria via login-enforcement.
-- Dinheiro em centavos. Uma assinatura por tenant.

CREATE TABLE IF NOT EXISTS "planos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"preco_centavos" integer NOT NULL DEFAULT 0,
	"ciclo" text NOT NULL DEFAULT 'mensal',
	"ativo" text NOT NULL DEFAULT 'true',
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assinaturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"plano_id" uuid REFERENCES "planos"("id") ON DELETE set null,
	"status" text NOT NULL DEFAULT 'trial',
	"preco_centavos" integer NOT NULL DEFAULT 0,
	"ciclo" text NOT NULL DEFAULT 'mensal',
	"vigente_ate" date,
	"trial_ate" date,
	"cancelada_em" timestamptz,
	"observacao" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assinaturas_tenant_uniq" ON "assinaturas" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assinaturas_status_idx" ON "assinaturas" ("status");
