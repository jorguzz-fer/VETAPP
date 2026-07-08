-- Previsão de alta na internação (doc 16 I2): data planejada de alta, exibida no
-- card do paciente internado ("Alta prevista" / "Sem previsão de alta"). Coluna
-- nullable → migração aditiva. `internacoes` já é tenant-scoped com RLS fail-closed.

ALTER TABLE "internacoes"
	ADD COLUMN IF NOT EXISTS "alta_prevista_em" date;
