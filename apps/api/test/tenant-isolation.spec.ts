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
// USER_1 pertence aos dois tenants (A e B); USER_2 só ao A. Provam o login sob RLS.
const USER_1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_2 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

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

  // Usuários + vínculos: USER_1 em A e B, USER_2 só em A. (users é global, sem RLS.)
  await adminSql`INSERT INTO users (id, email, name, password_hash) VALUES
    (${USER_1}, 'u1@example.com', 'User 1', 'x'),
    (${USER_2}, 'u2@example.com', 'User 2', 'x')`;
  await adminSql`INSERT INTO memberships (tenant_id, user_id, role) VALUES
    (${TENANT_A}, ${USER_1}, 'admin'),
    (${TENANT_B}, ${USER_1}, 'gestor'),
    (${TENANT_A}, ${USER_2}, 'recepcao')`;
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

  // ── Login sob RLS: memberships_self_read (migração 0018) ──
  // O login roda antes de haver tenant fixado; precisa ler os vínculos do próprio
  // usuário fixando app.current_user, sem BYPASSRLS e sem vazar entre tenants.

  it('login: fixando app.current_user, o usuário lê TODOS os seus vínculos (multi-tenant)', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    const rows = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_user', ${USER_1}, true)`;
      return tx`SELECT tenant_id, role FROM memberships ORDER BY role`;
    });
    // USER_1 pertence a A (admin) e B (gestor) — os dois vínculos aparecem.
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.tenant_id).sort()).toEqual([TENANT_A, TENANT_B].sort());
  });

  it('login: app.current_user só enxerga os PRÓPRIOS vínculos, não os de outro usuário', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    const rows = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_user', ${USER_2}, true)`;
      return tx`SELECT tenant_id, role FROM memberships`;
    });
    // USER_2 só tem vínculo em A — não vê os de USER_1.
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(TENANT_A);
    expect(rows[0].role).toBe('recepcao');
  });

  it('sem nenhum GUC, memberships fica invisível (fail-closed)', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    const rows = await appSql`SELECT 1 FROM memberships`;
    expect(rows).toHaveLength(0);
  });

  it('memberships continua isolado por tenant nas queries normais (app.current_tenant)', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    // Fixando o tenant B, vê-se só o vínculo de B — o self_read (sem current_user) fica inerte.
    const rows = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_B}, true)`;
      return tx`SELECT user_id, role FROM memberships`;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(USER_1);
    expect(rows[0].role).toBe('gestor');
  });

  // ── Auditoria (LGPD): isolamento por tenant + append-only — migração 0023 ──
  it('audit_log: isolado por tenant e imutável (append-only) para o papel da app', async (ctx) => {
    if (!dockerAvailable || !appSql || !adminSql) return ctx.skip();
    // Semeia uma linha em cada tenant (superusuário ignora o RLS).
    await adminSql`INSERT INTO audit_log (tenant_id, acao, entidade, resumo)
      VALUES (${TENANT_A}, 'auth.login', 'sessao', 'login A'),
             (${TENANT_B}, 'auth.login', 'sessao', 'login B')`;

    // Sob o tenant A, só a linha de A é visível.
    const visiveis = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
      return tx`SELECT tenant_id, resumo FROM audit_log`;
    });
    expect(visiveis).toHaveLength(1);
    expect(visiveis[0].resumo).toBe('login A');

    // INSERT sob o próprio tenant é permitido (a app registra auditoria).
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
      await tx`INSERT INTO audit_log (tenant_id, acao, entidade, resumo)
        VALUES (${TENANT_A}, 'usuario.criar', 'usuario', 'via app')`;
    });

    // Append-only: UPDATE e DELETE não afetam NENHUMA linha (RLS default-deny — não
    // há policy de UPDATE/DELETE). Prova a imutabilidade sem depender de grants.
    const upd = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
      return tx`UPDATE audit_log SET resumo = 'adulterado' WHERE tenant_id = ${TENANT_A}`;
    });
    expect(upd.count).toBe(0);
    const del = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
      return tx`DELETE FROM audit_log WHERE tenant_id = ${TENANT_A}`;
    });
    expect(del.count).toBe(0);

    // Nada foi adulterado nem removido: a linha original continua intacta.
    const final = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_tenant', ${TENANT_A}, true)`;
      return tx`SELECT resumo FROM audit_log WHERE acao = 'auth.login'`;
    });
    expect(final).toHaveLength(1);
    expect(final[0].resumo).toBe('login A');
  });

  // ── Robustez fiscal: número único por (tenant, série, número) — migração 0019 ──
  it('fiscal: mesmo número emitido colide; rascunhos (número NULL) convivem', async (ctx) => {
    if (!dockerAvailable || !adminSql) return ctx.skip();
    const [resp] = await adminSql`SELECT id FROM responsaveis WHERE tenant_id = ${TENANT_A} LIMIT 1`;
    const [fat] = await adminSql`SELECT id FROM faturas WHERE tenant_id = ${TENANT_A} LIMIT 1`;
    const nota = (numero: string | null) =>
      adminSql!`INSERT INTO notas_fiscais (tenant_id, fatura_id, responsavel_id, status, serie, numero, valor_centavos)
        VALUES (${TENANT_A}, ${fat.id}, ${resp.id}, ${numero ? 'emitida' : 'rascunho'}, '1', ${numero}, 10000)`;
    // Índice é PARCIAL (WHERE numero IS NOT NULL): dois rascunhos convivem.
    await nota(null);
    await nota(null);
    // Primeiro número emitido ok; repetir o mesmo (tenant, série, número) é barrado.
    await nota('100');
    await expect(nota('100')).rejects.toThrow();
    // Número diferente na mesma série: ok.
    await nota('101');
  });

  // ── Plataforma (SaaS): platform_audit_log é append-only — migração 0030 ──
  it('platform_audit_log: INSERT/SELECT ok, mas UPDATE/DELETE afetam 0 linhas (append-only)', async (ctx) => {
    if (!dockerAvailable || !appSql) return ctx.skip();
    // Insere e lê pelo papel da app (RLS: policies só SELECT/INSERT).
    await appSql`INSERT INTO platform_audit_log (acao, entidade, resumo)
      VALUES ('platform.login', 'sessao', 'login super-admin')`;
    const vis = await appSql`SELECT resumo FROM platform_audit_log WHERE acao = 'platform.login'`;
    expect(vis.length).toBeGreaterThanOrEqual(1);

    // Append-only: sem policy de UPDATE/DELETE → default-deny → 0 linhas afetadas.
    const upd = await appSql`UPDATE platform_audit_log SET resumo = 'adulterado' WHERE acao = 'platform.login'`;
    expect(upd.count).toBe(0);
    const del = await appSql`DELETE FROM platform_audit_log WHERE acao = 'platform.login'`;
    expect(del.count).toBe(0);
  });
});
