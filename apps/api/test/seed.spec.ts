import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { seed, DEMO_TENANT, DEMO_EMAIL_DOMAIN } from '../src/database/seed';

/**
 * Valida o seed de DEMO num Postgres real: aplica migrations, roda o seed e
 * confere que popula todos os módulos. Roda o seed DUAS vezes para provar a
 * idempotência (recria sem duplicar). Requer Docker; pulado sem ele (roda na CI).
 */
let container: StartedPostgreSqlContainer | undefined;
let sql: postgres.Sql | undefined;
let dockerAvailable = true;

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  } catch {
    dockerAvailable = false;
    return;
  }
  const uri = container.getConnectionUri();
  const admin = postgres(uri, { max: 1 });
  await migrate(drizzle(admin), { migrationsFolder: './src/database/migrations' });
  await admin.end();

  // Roda o seed 2x (idempotência).
  await seed(uri);
  await seed(uri);

  sql = postgres(uri, { max: 1 });
}, 180_000);

afterAll(async () => {
  await sql?.end({ timeout: 5 });
  await container?.stop();
});

describe('Seed de demonstração', () => {
  const count = async (q: string) => {
    const rows = await sql!.unsafe(q);
    return Number((rows[0] as { n: string }).n);
  };

  it('cria exatamente 1 tenant demo (idempotente após 2 execuções)', async (ctx) => {
    if (!dockerAvailable || !sql) return ctx.skip();
    const rows = await sql`SELECT id FROM tenants WHERE name = ${DEMO_TENANT}`;
    expect(rows).toHaveLength(1);
  });

  it('usuários e vínculos com papéis distintos', async (ctx) => {
    if (!dockerAvailable || !sql) return ctx.skip();
    expect(await count(`SELECT count(*) n FROM users WHERE email LIKE '%@${DEMO_EMAIL_DOMAIN}'`)).toBe(6);
    const papeis = await sql`SELECT DISTINCT role FROM memberships ORDER BY role`;
    expect(papeis.map((r) => r.role).sort()).toEqual(
      ['admin', 'financeiro', 'gestor', 'recepcao', 'veterinario'].sort(),
    );
  });

  it('popula os módulos clínico/comercial/internação', async (ctx) => {
    if (!dockerAvailable || !sql) return ctx.skip();
    expect(await count('SELECT count(*) n FROM tipos_atendimento')).toBe(6);
    expect(await count('SELECT count(*) n FROM formas_recebimento')).toBe(5);
    expect(await count('SELECT count(*) n FROM itens_catalogo')).toBe(14);
    expect(await count('SELECT count(*) n FROM responsaveis')).toBe(5);
    expect(await count('SELECT count(*) n FROM animais')).toBe(8);
    expect(await count('SELECT count(*) n FROM prontuario_eventos')).toBeGreaterThan(8);
    expect(await count('SELECT count(*) n FROM faturas')).toBe(3);
    expect(await count('SELECT count(*) n FROM fatura_itens')).toBe(6);
    expect(await count('SELECT count(*) n FROM recebimentos')).toBe(2);
    expect(await count('SELECT count(*) n FROM agendamentos')).toBe(7);
    expect(await count('SELECT count(*) n FROM internacoes')).toBe(1);
    expect(await count('SELECT count(*) n FROM internacao_execucoes')).toBe(4);
    expect(await count('SELECT count(*) n FROM internacao_parametros')).toBe(2);
    expect(await count('SELECT count(*) n FROM internacao_motivos')).toBe(5);
    expect(await count('SELECT count(*) n FROM internacao_boxes')).toBe(5);
    expect(await count('SELECT count(*) n FROM comissao_regras')).toBe(3);
    expect(await count('SELECT count(*) n FROM modelos_documento')).toBe(3);
    expect(await count('SELECT count(*) n FROM modelos_prescricao')).toBe(1);
    expect(await count('SELECT count(*) n FROM modelos_prescricao_itens')).toBe(3);
    expect(await count('SELECT count(*) n FROM fiscal_config')).toBe(1);
    expect(await count("SELECT count(*) n FROM site_config WHERE slug = 'vetexemplo'")).toBe(1);
    expect(await count('SELECT count(*) n FROM orcamentos')).toBe(1);
    expect(await count('SELECT count(*) n FROM orcamento_itens')).toBe(3);
  });

  it('saldo de estoque coerente (movimentos com sinal)', async (ctx) => {
    if (!dockerAvailable || !sql) return ctx.skip();
    // PRD003: +10 -8 = 2.
    const [row] = await sql`
      SELECT coalesce(sum(m.quantidade), 0)::int AS saldo
      FROM estoque_movimentos m
      JOIN itens_catalogo i ON i.id = m.item_id
      WHERE i.codigo = 'PRD003'`;
    expect(row.saldo).toBe(2);
  });
});
