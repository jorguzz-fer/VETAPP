-- Refresh token stateful do portal do tutor (doc 02 §2.2 / doc 13 §5): rotação por
-- family + detecção de reuso + revogação, igual à gestão (refresh_tokens). Tabela
-- GLOBAL sem RLS — a auth do tutor é separada da gestão e roda antes de haver
-- contexto de tenant; o escopo é por jti/credential_id no código.

CREATE TABLE IF NOT EXISTS "tutor_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credential_id" uuid NOT NULL REFERENCES "tutor_credentials"("id") ON DELETE cascade,
	"tenant_id" uuid NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"family" uuid NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"revoked_at" timestamptz,
	"replaced_by_id" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutor_refresh_tokens_credential_idx" ON "tutor_refresh_tokens" ("credential_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutor_refresh_tokens_family_idx" ON "tutor_refresh_tokens" ("family");
