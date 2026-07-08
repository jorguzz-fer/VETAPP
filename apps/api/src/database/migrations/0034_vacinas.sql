-- Protocolos vacinais (doc 16 PR9): registro de vacinas aplicadas por paciente —
-- vacina, laboratório, lote, data de aplicação, quem aplicou e a PRÓXIMA dose
-- (base para o lembrete automático de vacina vencendo). Tenant-scoped com RLS
-- fail-closed (padrão NULLIF). `aplicada_por` referencia o usuário (global, sem FK
-- de tenant) — nullable para não travar o registro clínico.

CREATE TABLE IF NOT EXISTS "vacinas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"animal_id" uuid NOT NULL REFERENCES "animais"("id") ON DELETE cascade,
	"nome" text NOT NULL,
	"laboratorio" text,
	"lote" text,
	"aplicada_em" date NOT NULL,
	"proxima_em" date,
	"aplicada_por" uuid,
	"observacao" text,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vacinas_tenant_idx" ON "vacinas" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vacinas_animal_idx" ON "vacinas" ("tenant_id", "animal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vacinas_proxima_idx" ON "vacinas" ("tenant_id", "proxima_em");
--> statement-breakpoint
ALTER TABLE "vacinas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vacinas" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "vacinas_tenant_isolation" ON "vacinas"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
