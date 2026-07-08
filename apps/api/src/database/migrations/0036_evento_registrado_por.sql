-- Autor do evento do prontuário (doc 16 PR7): quem registrou cada evento, para a
-- "evolução por médico" na linha do tempo. Coluna nullable → migração aditiva
-- (eventos antigos ficam sem autor). `registrado_por` referencia o usuário (tabela
-- global users, sem FK de tenant). `prontuario_eventos` já é tenant-scoped com RLS.

ALTER TABLE "prontuario_eventos"
	ADD COLUMN IF NOT EXISTS "registrado_por" uuid;
