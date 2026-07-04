-- Portal do tutor (doc 13 §5): credencial de acesso do tutor à área do cliente.
-- Tabela GLOBAL (como `users`): SEM RLS — o login roda antes de haver contexto de
-- tenant. O escopo é por tenant_id/responsavel_id no código + token scope 'tutor'.
CREATE TABLE IF NOT EXISTS "tutor_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"invite_token_hash" text,
	"invite_expires_at" timestamp with time zone,
	"status" text DEFAULT 'invited' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_credentials" ADD CONSTRAINT "tutor_credentials_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tutor_credentials" ADD CONSTRAINT "tutor_credentials_responsavel_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."responsaveis"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tutor_credentials_responsavel_unique" ON "tutor_credentials" ("responsavel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutor_credentials_tenant_email_idx" ON "tutor_credentials" ("tenant_id","email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tutor_credentials_invite_idx" ON "tutor_credentials" ("invite_token_hash");
