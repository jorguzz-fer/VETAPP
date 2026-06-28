import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

// Usuário = identidade global. O vínculo com um tenant (e papel) vive em memberships.
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'), // null quando só login social
  googleSub: text('google_sub'),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  mfaSecret: text('mfa_secret'), // TOTP — cifrado/gerido fora do escopo deste scaffold
  status: text('status').notNull().default('active'), // active | disabled
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
