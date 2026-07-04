-- Baixa automática de estoque via prontuário (doc 13 §2): o evento clínico passa a
-- referenciar um item do catálogo (+ quantidade). Quando o item é estocável
-- (produto/medicamento/vacina) e há saldo, registrar o evento dá baixa no estoque
-- (mesma regra da internação). Colunas nullable/default → migração aditiva, sem
-- quebrar eventos existentes. FK ON DELETE set null: apagar o item não apaga o evento.

ALTER TABLE "prontuario_eventos"
	ADD COLUMN IF NOT EXISTS "item_id" uuid,
	ADD COLUMN IF NOT EXISTS "quantidade" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'prontuario_eventos_item_id_fk'
	) THEN
		ALTER TABLE "prontuario_eventos"
			ADD CONSTRAINT "prontuario_eventos_item_id_fk"
			FOREIGN KEY ("item_id") REFERENCES "itens_catalogo"("id") ON DELETE set null;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prontuario_eventos_item_idx" ON "prontuario_eventos" ("tenant_id", "item_id");
