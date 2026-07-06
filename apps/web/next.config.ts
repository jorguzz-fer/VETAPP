import type { NextConfig } from 'next';
import path from 'node:path';

// Origem da API (build-time) — liberada no connect-src da CSP para o cliente
// conseguir chamar a API. Em produção, definir NEXT_PUBLIC_API_URL.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

// Content-Security-Policy — segunda camada contra XSS (defense-in-depth para os
// tokens ainda guardados no client, ver docs/security). Libera o Google Identity
// Services (login) e a origem da API. Next precisa de 'unsafe-inline'/'unsafe-eval'
// para hydration/refresh — endurecer com nonce exige middleware (follow-up).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl} https://accounts.google.com`,
  'frame-src https://accounts.google.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

// Deploy (Coolify/Docker): 'standalone' gera um server.js mínimo + node_modules
// traçados, sem precisar do pnpm no runtime. outputFileTracingRoot aponta para a
// raiz do monorepo para o tracing achar os workspace packages (api-client,
// design-tokens) — ver apps/web/Dockerfile e docs/spec/14.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
