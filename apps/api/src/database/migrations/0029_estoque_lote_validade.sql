-- Lote e validade no estoque (doc 13 §2, fase 2): a entrada passa a registrar lote
-- e data de validade, alimentando o alerta de vencimento próximo. Colunas nullable
-- → migração aditiva (movimentos antigos ficam sem lote/validade). Índice por
-- (tenant, validade) para a consulta de vencimentos.

ALTER TABLE "estoque_movimentos"
	ADD COLUMN IF NOT EXISTS "lote" text,
	ADD COLUMN IF NOT EXISTS "validade" date;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estoque_movimentos_validade_idx" ON "estoque_movimentos" ("tenant_id", "validade");
