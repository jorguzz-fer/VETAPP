import type { NextConfig } from 'next';

// Scaffold: modo padrão (permite dev/SSR). A decisão SPA estático (output:'export')
// × Next SSR fica para o início da Fase 1 — ver docs/spec/10 §2.
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
