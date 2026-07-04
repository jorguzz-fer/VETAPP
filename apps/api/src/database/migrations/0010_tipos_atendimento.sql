CREATE TABLE IF NOT EXISTS "tipos_atendimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"duracao_minutos" integer DEFAULT 30 NOT NULL,
	"cor" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tipos_atendimento" ADD CONSTRAINT "tipos_atendimento_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tipos_atendimento_tenant_idx" ON "tipos_atendimento" ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_atendimento_nome_uniq" ON "tipos_atendimento" ("tenant_id","nome");
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "tipo_atendimento_id" uuid;
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_tipo_atendimento_id_fk" FOREIGN KEY ("tipo_atendimento_id") REFERENCES "public"."tipos_atendimento"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "tipos_atendimento" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tipos_atendimento" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tipos_atendimento_tenant_isolation" ON "tipos_atendimento"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
