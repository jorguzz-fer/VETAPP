# ───────── build ─────────
FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@9.12.0

# Manifests + lockfile primeiro (cache de deps). Contexto de build = raiz do
# monorepo. Todos os package.json do workspace precisam existir para o
# frozen-lockfile reconstruir o grafo, mesmo que só a API seja instalada (--filter).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
# O build precisa das devDependencies (nest cli, typescript). O Coolify injeta
# NODE_ENV=production no build, o que faria o pnpm pular as devDeps ("nest: not
# found") — por isso forçamos NODE_ENV=development só neste install.
RUN NODE_ENV=development pnpm install --filter @vetapp/api... --frozen-lockfile

COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN pnpm --filter @vetapp/api build && pnpm --filter @vetapp/api deploy --prod /out

# ───────── runtime ─────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Porta padrão coerente com o EXPOSE (main.ts usa API_PORT). Sobrescreva se precisar.
ENV API_PORT=3000
# Usuário não-root
USER node
COPY --chown=node:node --from=build /out/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/api/dist ./dist
COPY --chown=node:node --from=build /app/apps/api/src/database/migrations ./src/database/migrations
EXPOSE 3000
# Aplica as migrations (como admin, via DATABASE_ADMIN_URL) no START do container,
# antes de subir a API. Idempotente: o drizzle só aplica o que falta. Se a migration
# falhar, o `&&` aborta e o container não sobe com schema quebrado (fail-fast).
# `exec` passa PID 1 para o node (SIGTERM → shutdown gracioso). Para pular (schema
# gerido à parte), defina RUN_MIGRATIONS=false.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" != \"false\" ]; then node dist/database/migrate.js; fi && exec node dist/main.js"]
