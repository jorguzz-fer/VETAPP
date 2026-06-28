import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Aplica as migrations usando o usuário ADMIN (DDL + políticas RLS).
 * Rodar: pnpm db:migrate
 */
async function main(): Promise<void> {
  const url =
    process.env.DATABASE_ADMIN_URL ??
    'postgresql://vetapp_admin:admin_password@localhost:5432/vetapp';
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: './src/database/migrations' });
  await client.end();
  // eslint-disable-next-line no-console
  console.log('Migrations aplicadas.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
