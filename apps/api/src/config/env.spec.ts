import { describe, it, expect } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a-very-long-secret-value',
    JWT_REFRESH_SECRET: 'another-long-secret-value',
  } as NodeJS.ProcessEnv;

  it('aplica defaults e faz parse de CORS_ORIGINS em lista', () => {
    const env = loadEnv({ ...base, CORS_ORIGINS: 'http://a.com, http://b.com' });
    expect(env.API_PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
  });

  it('falha quando faltam segredos obrigatórios', () => {
    expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL } as NodeJS.ProcessEnv)).toThrow();
  });
});
