import type { NextConfig } from 'next';
import path from 'node:path';

// Deploy (Coolify/Docker): 'standalone' gera um server.js mínimo + node_modules
// traçados, sem precisar do pnpm no runtime. outputFileTracingRoot aponta para a
// raiz do monorepo para o tracing achar os workspace packages (api-client,
// design-tokens) — ver apps/web/Dockerfile e docs/spec/14.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
