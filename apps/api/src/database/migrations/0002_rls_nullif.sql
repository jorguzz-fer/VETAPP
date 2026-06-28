-- Endurece as políticas RLS: trata app.current_tenant ausente/vazio como NULL.
--
-- current_setting('app.current_tenant', true) devolve '' (string vazia), não NULL,
-- depois que o GUC é referenciado na sessão. Sem o NULLIF, '' ::uuid lança
-- "invalid input syntax for type uuid" (22P02). Com NULLIF, vira NULL → a condição
-- tenant_id = NULL é falsa → ZERO linhas (fail-closed), em vez de erro.
-- (Defense-in-depth: se a aplicação esquecer de fixar o tenant, não vaza nem quebra.)

DROP POLICY IF EXISTS "memberships_tenant_isolation" ON "memberships";
--> statement-breakpoint
CREATE POLICY "memberships_tenant_isolation" ON "memberships"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
DROP POLICY IF EXISTS "responsaveis_tenant_isolation" ON "responsaveis";
--> statement-breakpoint
CREATE POLICY "responsaveis_tenant_isolation" ON "responsaveis"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
--> statement-breakpoint
DROP POLICY IF EXISTS "animais_tenant_isolation" ON "animais";
--> statement-breakpoint
CREATE POLICY "animais_tenant_isolation" ON "animais"
	USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
