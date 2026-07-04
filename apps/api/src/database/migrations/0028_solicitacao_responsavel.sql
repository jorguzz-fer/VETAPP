-- Conversão de solicitação do site → cliente (doc 13 §4.2): a solicitação de
-- agendamento pública passa a poder virar um responsável/cliente de verdade na
-- triagem. `responsavel_id` liga a solicitação ao cadastro criado (null = ainda não
-- convertida). Coluna nullable → migração aditiva. FK ON DELETE set null.

ALTER TABLE "agendamento_solicitacoes"
	ADD COLUMN IF NOT EXISTS "responsavel_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'agendamento_solicitacoes_responsavel_id_fk'
	) THEN
		ALTER TABLE "agendamento_solicitacoes"
			ADD CONSTRAINT "agendamento_solicitacoes_responsavel_id_fk"
			FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id") ON DELETE set null;
	END IF;
END $$;
