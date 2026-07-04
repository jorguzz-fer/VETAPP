CREATE TABLE IF NOT EXISTS "internacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"motivo" text NOT NULL,
	"box" text,
	"status" text DEFAULT 'internado' NOT NULL,
	"entrada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"alta_em" timestamp with time zone,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internacoes" ADD CONSTRAINT "internacoes_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internacoes" ADD CONSTRAINT "internacoes_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animais"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "internacoes_tenant_idx" ON "internacoes" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "internacoes_status_idx" ON "internacoes" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "internacoes_animal_idx" ON "internacoes" ("tenant_id","animal_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "internacao_execucoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"internacao_id" uuid NOT NULL,
	"item_id" uuid,
	"descricao" text NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"valor_centavos" integer,
	"executada_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internacao_execucoes" ADD CONSTRAINT "internacao_execucoes_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internacao_execucoes" ADD CONSTRAINT "internacao_execucoes_internacao_id_fk" FOREIGN KEY ("internacao_id") REFERENCES "public"."internacoes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internacao_execucoes" ADD CONSTRAINT "internacao_execucoes_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "internacao_execucoes_tenant_idx" ON "internacao_execucoes" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "internacao_execucoes_internacao_idx" ON "internacao_execucoes" ("tenant_id","internacao_id");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "internacoes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "internacoes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "internacoes_tenant_isolation" ON "internacoes"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "internacao_execucoes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "internacao_execucoes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "internacao_execucoes_tenant_isolation" ON "internacao_execucoes"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
