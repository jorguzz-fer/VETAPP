import { describe, it } from 'vitest';

/**
 * Teste OBRIGATÓRIO de isolamento de tenant (docs/spec/12 §3.1).
 *
 * Deve subir um Postgres efêmero (Testcontainers), aplicar as migrations (com RLS),
 * conectar como o usuário da APLICAÇÃO (vetapp_app, sem BYPASSRLS) e provar que,
 * fixando app.current_tenant = A, NENHUMA linha do tenant B é visível/alterável.
 *
 * Marcado como `todo` neste scaffold até a infra de teste (Testcontainers) entrar.
 */
describe('Isolamento de tenant (RLS)', () => {
  it.todo('tenant A não enxerga memberships do tenant B');
  it.todo('insert em memberships com tenant divergente é barrado pelo WITH CHECK');
});
