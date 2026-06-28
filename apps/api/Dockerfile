# ───────── build ─────────
FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@9.12.0

# Manifests (cache de deps). Contexto de build = raiz do monorepo.
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @vetapp/api... --frozen-lockfile || pnpm install --filter @vetapp/api...

COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN pnpm --filter @vetapp/api build && pnpm --filter @vetapp/api deploy --prod /out

# ───────── runtime ─────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Usuário não-root
USER node
COPY --chown=node:node --from=build /out/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/api/dist ./dist
COPY --chown=node:node --from=build /app/apps/api/src/database/migrations ./src/database/migrations
EXPOSE 3000
CMD ["node", "dist/main.js"]
