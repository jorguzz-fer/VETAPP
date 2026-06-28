CREATE TABLE IF NOT EXISTS "responsaveis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"codigo" text,
	"nome" text NOT NULL,
	"email" text,
	"telefone" text,
	"documento" text,
	"origem" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "animais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"codigo" text,
	"nome" text NOT NULL,
	"especie" text,
	"raca" text,
	"sexo" text,
	"castrado" boolean DEFAULT false NOT NULL,
	"nascimento" date,
	"status" text DEFAULT 'vivo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "responsaveis" ADD CONSTRAINT "responsaveis_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "animais" ADD CONSTRAINT "animais_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "animais" ADD CONSTRAINT "animais_responsavel_id_responsaveis_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."responsaveis"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "responsaveis_tenant_idx" ON "responsaveis" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "responsaveis_nome_idx" ON "responsaveis" ("tenant_id","nome");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "animais_tenant_idx" ON "animais" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "animais_responsavel_idx" ON "animais" ("tenant_id","responsavel_id");
--> statement-breakpoint
-- ───────── RLS (isolamento por tenant) ─────────
ALTER TABLE "responsaveis" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "responsaveis" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "responsaveis_tenant_isolation" ON "responsaveis"
	USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
	WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);
--> statement-breakpoint
ALTER TABLE "animais" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "animais" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "animais_tenant_isolation" ON "animais"
	USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
	WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);
