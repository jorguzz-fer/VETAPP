-- Robustez fiscal: garante que o número de NFS-e emitido é único por tenant+série.
-- A numeração vem do config (proximo_numero) e, sob emissões concorrentes, duas
-- notas poderiam receber o mesmo número. Além do row-lock no serviço (SELECT ...
-- FOR UPDATE no fiscal_config), este índice é o backstop no banco.
--
-- Índice PARCIAL (WHERE numero IS NOT NULL): rascunhos têm numero NULL e não
-- devem colidir entre si; a unicidade só vale para números já atribuídos.

CREATE UNIQUE INDEX IF NOT EXISTS "notas_fiscais_numero_uniq"
	ON "notas_fiscais" ("tenant_id", "serie", "numero")
	WHERE "numero" IS NOT NULL;
