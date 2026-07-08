-- Campos de cadastro do paciente (doc 16 P2): pelagem, microchip, marcações/tags,
-- pedigree (sim/não + número). Colunas nullable / com default → migração aditiva
-- (pacientes existentes ficam sem esses dados). `animais` já é tenant-scoped com RLS
-- fail-closed (não muda policy). `marcacoes` é text[] para permitir recorte por tag.

ALTER TABLE "animais"
	ADD COLUMN IF NOT EXISTS "pelagem" text,
	ADD COLUMN IF NOT EXISTS "microchip" text,
	ADD COLUMN IF NOT EXISTS "marcacoes" text[] NOT NULL DEFAULT '{}',
	ADD COLUMN IF NOT EXISTS "pedigree" boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS "pedigree_numero" text;
