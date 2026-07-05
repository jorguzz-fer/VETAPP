import { z } from 'zod';

// Validação fail-fast da configuração (12-factor). Sem env válido, a API não sobe.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  DATABASE_URL: z.string().url(),
  DATABASE_ADMIN_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),

  // Login com Google (OIDC). Opcional: sem isto, o endpoint /auth/google fica
  // desabilitado (a app sobe normalmente).
  GOOGLE_CLIENT_ID: z.string().optional(),

  // Bootstrap do 1º super-admin da plataforma (doc 15 §2). Opcional: se ambos
  // presentes e válidos, o boot cria/garante esse admin (idempotente) — nunca por
  // rota pública. Segredo só na ENV do Coolify, nunca no repo.
  //
  // Validação intencionalmente FROUXA aqui (só string): um valor malformado numa var
  // OPCIONAL de conveniência jamais pode derrubar a API inteira em loop. O formato
  // (e-mail válido, senha ≥ 12) é checado no PlatformBootstrapService, que é
  // best-effort e apenas PULA o bootstrap com um aviso se algo estiver errado.
  PLATFORM_BOOTSTRAP_EMAIL: z.string().optional(),
  PLATFORM_BOOTSTRAP_PASSWORD: z.string().optional(),

  // Object storage (Cloudflare R2 / S3-compatível). Opcional: sem isto, uploads
  // ficam desabilitados (a app sobe normalmente em dev/CI). Credenciais só aqui,
  // nunca no cliente (docs/spec/02).
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): EnvConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida (.env):\n${issues}`);
  }
  return parsed.data;
}
