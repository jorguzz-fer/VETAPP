# Build do frontend Next.js (standalone) — contexto de build = raiz do monorepo.
# ───────── build ─────────
FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@9.12.0

# Manifests + lockfile primeiro (cache de deps). Todos os package.json do
# workspace presentes para o frozen-lockfile reconstruir o grafo.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
# next build precisa das devDependencies (typescript, tailwind, @types). Coolify
# injeta NODE_ENV=production no build → forçar dev deps só neste install.
RUN NODE_ENV=development pnpm install --filter @vetapp/web... --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web

# NEXT_PUBLIC_* são embutidos no bundle no momento do BUILD (não em runtime).
# Passe via build args no Coolify.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @vetapp/web build

# ───────── runtime ─────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next standalone respeita PORT/HOSTNAME.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
USER node

# standalone = server.js + node_modules mínimos (estrutura do monorepo preservada).
COPY --chown=node:node --from=build /app/apps/web/.next/standalone ./
COPY --chown=node:node --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --chown=node:node --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
