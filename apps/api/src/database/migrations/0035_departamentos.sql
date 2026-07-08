-- Departamentos da agenda (doc 16 A1): dimensão de organização/visualização da
-- agenda além do profissional (ex.: Clínica, Hotel, Banho & Tosa). Tenant-scoped
-- com RLS fail-closed (padrão NULLIF). `agendamentos.departamento_id` liga o
-- agendamento ao departamento (nullable, SET NULL na remoção).

CREATE TABLE IF NOT EXISTS "departamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"nome" text NOT NULL,
	"cor" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "departamentos_tenant_idx" ON "departamentos" ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "departamentos_nome_uniq" ON "departamentos" ("tenant_id", "nome");
--> statement-breakpoint
ALTER TABLE "departamentos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "departamentos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "departamentos_tenant_isolation" ON "departamentos"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "agendamentos"
	ADD COLUMN IF NOT EXISTS "departamento_id" uuid REFERENCES "departamentos"("id") ON DELETE set null;
