import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Teste OBRIGATÓRIO de isolamento de tenant (docs/spec/12 §3.1).
 *
 * Sobe um Postgres efêmero (Testcontainers), aplica as migrations (com RLS) como
 * superusuário, cria um papel de APLICAÇÃO sem BYPASSRLS e prova que, fixando
 * app.current_tenant = A, nenhum dado do tenant B é visível nem inserível.
 *
 * Requer Docker. Sem Docker (ex.: ambiente sem daemon), o suite é PULADO — assim
 * `pnpm test` não quebra para quem não tem Docker; a verificação real roda na CI.
 */
const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ITEM_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ITEM_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

let container: StartedPostgreSqlContainer | undefined;
let adminSql: postgres.Sql | undefined;
let appSql: postgres.Sql | undefined;
let dockerAvailable = true;

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  } catch {
    dockerAvailable = false;
    return;
  }

  adminSql = postgres(container.getConnectionUri(), { max: 1 });

  // Migrations (cria tabelas + políticas RLS) como superusuário.
  await migrate(drizzle(adminSql), { migrationsFolder: './src/database/migrations' });

  // Papel de aplicação: SEM superuser e SEM BYPASSRLS → sujeito ao RLS.
  await adminSql`CREATE ROLE app_role LOGIN PASSWORD 'app' NOBYPASSRLS NOSUPERUSER`;
  await adminSql`GRANT USAGE ON SCHEMA public TO app_role`;
  await adminSql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role`;
  await adminSql`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role`;

  // Seed de dois tenants e um responsável de cada (superusuário ignora o RLS).
  await adminSql`INSERT INTO tenants (id, name) VALUES (${TENANT_A}, 'Tenant A'), (${TENANT_B}, 'Tenant B')`;
  await adminSql`INSERT INTO responsaveis (tenant_id, nome) VALUES (${TENANT_A}, 'Cliente A'), (${TENANT_B}, 'Cliente B')`;

  // Estoque: item por tenant + movimentos (A: +10 -3 = 7 | B: +5) para provar
  // que o saldo (SUM) só enxerga o próprio tenant sob RLS.
  await adminSql`INSERT INTO itens_catalogo (id, tenant_id, codigo, nome, tipo, preco_centavos) VALUES
    (${ITEM_A}, ${TENANT_A}, 'P1', 'Ração A', 'produto', 1000),
    (${ITEM_B}, ${TENANT_B}, 'P1', 'Ração B', 'produto', 1000)`;
  await adminSql`INSERT INTO estoque_movimentos (tenant_id, item_id, tipo, quantidade) VALUES
    (${TENANT_A}, ${ITEM_A}, 'entrada', 10),
    (${TENANT_A}, ${ITEM_A}, 'saida', -3),
    (${TENANT_B}, ${ITEM_B}, 'entrada', 5)`;

  // Financeiro fase 2: fatura + recebimento parcial só no tenant A.
  await adminSql`INSERT INTO faturas (tenant_id, responsavel_id, total_centavos)
    SELECT ${TENANT_A}, id, 10000 FROM responsaveis WHERE tenant_id = ${TENANT_A}`;
  await adminSql`INSERT INTO recebimentos (tenant_id, fatura_id, valor_centavos)
    SELECT ${TENANT_A}, id, 4000 FROM faturas WHERE tenant_id = ${TENANT_A}`;

  // Internação: animal + internação ativa só no tenant A.
  await adminSql`INSERT INTO animais (tenant_id, responsavel_id, nome)
    SELECT ${TENANT_A}, id, 'Rex' FROM responsaveis WHERE tenant_id = ${TENANT_A}`;
  await adminSql`INSERT INTO internacoes (tenant_id, animal_id, motivo)
    SELECT ${TENANT_A}, id, 'Observação pós-cirúrgica' FROM animais WHERE tenant_id = ${TENANT_A}`;

  // Conexão como app_role (sujeita ao RLS).
  appSql = postgres({
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    username: 'app_role',
    password: 'app',
    max: 1,
  });
}, 180_000);

afterAll(async () => {
  await appSql?.end({ timeout: 5 });
  await adminSql?.end({ timeout: 5 });
  await container?.stop();
});

describe('Isolamento de tenant (RLS)', () => {
  it('tenant A só enxerga responsáveis do tenant A', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    const rows = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
      return tx`SELECT tenant_id, nome FROM responsaveis`;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].nome).toBe('Cliente A');
    expect(rows[0].tenant_id).toBe(TENANT_A);
  });

  it('sem tenant fixado, nenhuma linha é visível', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    const rows = await appSql`SELECT 1 FROM responsaveis`;
    expect(rows).toHaveLength(0);
  });

  it('insert com tenant divergente é barrado pelo WITH CHECK', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    await expect(
      appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
        // tenta inserir no tenant B enquanto o contexto é A → deve falhar.
        await tx`INSERT INTO responsaveis (tenant_id, nome) VALUES (${TENANT_B}, 'Invasor')`;
      }),
    ).rejects.toThrow();
  });

  it('internações do tenant A são invisíveis para o tenant B', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    const doB = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_B}, true)`;
      return tx`SELECT 1 FROM internacoes`;
    });
    expect(doB).toHaveLength(0);
    const doA = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
      return tx`SELECT status FROM internacoes`;
    });
    expect(doA).toHaveLength(1);
    expect(doA[0].status).toBe('internado');
  });

  it('recebimentos do tenant A são invisíveis para o tenant B', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    const doB = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_B}, true)`;
      return tx`SELECT coalesce(sum(valor_centavos), 0)::int AS total FROM recebimentos`;
    });
    expect(doB[0].total).toBe(0);
    const doA = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
      return tx`SELECT coalesce(sum(valor_centavos), 0)::int AS total FROM recebimentos`;
    });
    expect(doA[0].total).toBe(4000);
  });

  it('saldo de estoque só soma movimentos do próprio tenant', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    const rows = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
      return tx`SELECT coalesce(sum(quantidade), 0)::int AS saldo FROM estoque_movimentos`;
    });
    // Só os movimentos de A entram na soma: 10 - 3 = 7 (os +5 de B ficam invisíveis).
    expect(rows[0].saldo).toBe(7);
  });
});
