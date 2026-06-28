CREATE TABLE IF NOT EXISTS "prontuario_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"descricao" text NOT NULL,
	"valor_centavos" integer,
	"data" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"status" text DEFAULT 'aberta' NOT NULL,
	"total_centavos" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fatura_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fatura_id" uuid NOT NULL,
	"evento_id" uuid,
	"descricao" text NOT NULL,
	"valor_centavos" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prontuario_eventos" ADD CONSTRAINT "prontuario_eventos_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "prontuario_eventos" ADD CONSTRAINT "prontuario_eventos_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animais"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_responsavel_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."responsaveis"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fatura_itens" ADD CONSTRAINT "fatura_itens_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fatura_itens" ADD CONSTRAINT "fatura_itens_fatura_id_fk" FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fatura_itens" ADD CONSTRAINT "fatura_itens_evento_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."prontuario_eventos"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prontuario_eventos_tenant_idx" ON "prontuario_eventos" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prontuario_eventos_animal_idx" ON "prontuario_eventos" ("tenant_id","animal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faturas_tenant_idx" ON "faturas" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faturas_responsavel_idx" ON "faturas" ("tenant_id","responsavel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fatura_itens_tenant_idx" ON "fatura_itens" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fatura_itens_fatura_idx" ON "fatura_itens" ("tenant_id","fatura_id");
--> statement-breakpoint
-- ───────── RLS por tenant (fail-closed com NULLIF — ver migracao 0002) ─────────
ALTER TABLE "prontuario_eventos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "prontuario_eventos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "prontuario_eventos_tenant_isolation" ON "prontuario_eventos"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "faturas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "faturas" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "faturas_tenant_isolation" ON "faturas"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "fatura_itens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fatura_itens" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "fatura_itens_tenant_isolation" ON "fatura_itens"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
