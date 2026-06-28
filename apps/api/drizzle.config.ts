import { defineConfig } from 'drizzle-kit';

// Migrations são aplicadas com o usuário ADMIN (DDL + políticas RLS).
export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_ADMIN_URL ?? 'postgresql://vetapp_admin:admin_password@localhost:5432/vetapp',
  },
  verbose: true,
  strict: true,
});
