-- Site público (doc 13 §4): CMS-lite + solicitação de agendamento.
-- site_config é GLOBAL (sem RLS): leitura pública por slug antes do contexto de
-- tenant (como `users`); edição filtrada por tenant_id no código. Conteúdo público.
CREATE TABLE IF NOT EXISTS "site_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"publicado" boolean DEFAULT false NOT NULL,
	"nome_exibicao" text,
	"sobre" text,
	"servicos" text,
	"endereco" text,
	"telefone" text,
	"whatsapp" text,
	"email" text,
	"horario" text,
	"cor_primaria" text,
	"logo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_config" ADD CONSTRAINT "site_config_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "site_config_tenant_unique" ON "site_config" ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "site_config_slug_unique" ON "site_config" ("slug");
--> statement-breakpoint
-- Solicitação de agendamento: PII do visitante = dado da clínica → RLS por tenant.
CREATE TABLE IF NOT EXISTS "agendamento_solicitacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"email" text,
	"pet_nome" text,
	"servico_desejado" text,
	"preferencia" text,
	"mensagem" text,
	"origem" text,
	"status" text DEFAULT 'nova' NOT NULL,
	"observacao_interna" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agendamento_solicitacoes" ADD CONSTRAINT "agendamento_solicitacoes_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agendamento_solicitacoes_tenant_idx" ON "agendamento_solicitacoes" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agendamento_solicitacoes_status_idx" ON "agendamento_solicitacoes" ("tenant_id","status");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "agendamento_solicitacoes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agendamento_solicitacoes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agendamento_solicitacoes_tenant_isolation" ON "agendamento_solicitacoes"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
