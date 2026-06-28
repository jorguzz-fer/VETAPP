CREATE TABLE IF NOT EXISTS "agendamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"profissional_id" uuid,
	"animal_id" uuid,
	"responsavel_id" uuid,
	"titulo" text NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'agendado' NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_profissional_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animais"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_responsavel_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."responsaveis"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agendamentos_tenant_idx" ON "agendamentos" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agendamentos_inicio_idx" ON "agendamentos" ("tenant_id","inicio");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "agendamentos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agendamentos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agendamentos_tenant_isolation" ON "agendamentos"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
