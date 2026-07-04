-- Login precisa ler os vínculos do próprio usuário ANTES de existir contexto de
-- tenant (o login é justamente quem resolve qual tenant usar). Como `memberships`
-- tem RLS e a app conecta como `vetapp_app` (NOBYPASSRLS), a leitura por
-- `user_id` sem `app.current_tenant` fixado volta ZERO linhas (fail-closed) e o
-- login quebra com "Usuário sem acesso a nenhum tenant".
--
-- Correção fail-closed, SEM BYPASSRLS: uma segunda policy PERMISSIVE, restrita a
-- SELECT, que libera a linha quando `app.current_user` casa com o `user_id`. O
-- fluxo de auth fixa esse GUC (via DatabaseService.withUser) só para ler os
-- próprios memberships. Fora do login, `app.current_user` nunca é setado →
-- NULLIF(...,'') vira NULL → `user_id = NULL` é falso → policy inerte. O
-- isolamento por tenant das queries normais (que setam apenas app.current_tenant)
-- fica intacto: continua valendo a policy `memberships_tenant_isolation`.
--
-- Escrita (INSERT/UPDATE/DELETE) permanece estritamente tenant-scoped: esta
-- policy é FOR SELECT, então o register continua obrigado a usar withTenant.

CREATE POLICY "memberships_self_read" ON "memberships"
	FOR SELECT
	USING ("user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid);
