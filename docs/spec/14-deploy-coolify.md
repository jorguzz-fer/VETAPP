# 14 — Deploy no Coolify (VPS Hostinger)

> Runbook de produção. Reverse proxy do Coolify (Traefik) é a **única porta
> pública** (443); Postgres/Redis ficam na rede interna. Segue os princípios do
> doc 01 (arquitetura) e doc 02/03 (segurança/multitenancy). **Sem segredos aqui**
> — apenas placeholders `<...>`.

## Resources

| Resource | Tipo no Coolify | Origem |
|----------|-----------------|--------|
| PostgreSQL 16 | Database → PostgreSQL | interno |
| API (NestJS) | Application → Dockerfile | `apps/api/Dockerfile`, contexto = raiz do repo, porta 3000 |
| Web (Next.js) | Application → Dockerfile | `apps/web/Dockerfile`, contexto = raiz do repo, porta 3000 |
| Redis 7 | Database → Redis | **opcional** (`REDIS_URL` é opcional) |

Externos: **Cloudflare R2** (bucket + API token) e **Google OAuth Client ID**
(opcional).

## ⚠️ Passo crítico: papel de aplicação no Postgres

O Postgres gerenciado **não roda** `infra/postgres-init/01-init.sql` (isso só vale
no Compose de dev). Rode uma vez, via `psql` no container do banco, para criar o
papel **sem `BYPASSRLS`** (senão o RLS multitenant é ignorado — doc 03):

```sql
CREATE ROLE vetapp_app LOGIN PASSWORD '<SENHA_APP>' NOBYPASSRLS NOSUPERUSER;
GRANT CONNECT ON DATABASE vetapp TO vetapp_app;
GRANT USAGE ON SCHEMA public TO vetapp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE <SUPERUSER> IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vetapp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE <SUPERUSER> IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vetapp_app;
```

Daí saem **dois** connection strings: `DATABASE_ADMIN_URL` (superusuário, para
migrations/DDL/RLS) e `DATABASE_URL` (`vetapp_app`, runtime da app).

## Migrations

**Rodam automaticamente no START do container da API** (entrypoint do Dockerfile:
`node dist/database/migrate.js && exec node dist/main.js`), usando `DATABASE_ADMIN_URL`.
São idempotentes (o drizzle aplica só o que falta) e **fail-fast**: se a migration
falhar, o container não sobe com schema quebrado. **Nada manual no deploy normal.**

- **NÃO** roda no `docker build` (a imagem é construída sem acesso ao banco; um build
  jamais deve tocar dados de produção). O lugar correto é o *release*/start.
- Requer `DATABASE_ADMIN_URL` setada nas ENVs da API (papel admin — DDL + RLS).
- Para gerir o schema à parte, defina `RUN_MIGRATIONS=false` (o boot pula o migrate).
- Fallback manual (raro — ex.: reaplicar após restore): no Terminal da API,
  `node dist/database/migrate.js`.

> Evita o pre-deploy command do Coolify de propósito: ele roda no **container antigo**
> e é pulado se ele estiver morto ("Skipping"). O entrypoint sempre roda com a imagem
> nova.

## ENVs — API

```
NODE_ENV=production
API_PORT=3000
DATABASE_URL=postgresql://vetapp_app:<SENHA_APP>@<POSTGRES_HOST>:5432/vetapp
DATABASE_ADMIN_URL=postgresql://<SUPERUSER>:<SENHA_ADMIN>@<POSTGRES_HOST>:5432/vetapp
CORS_ORIGINS=https://<DOMINIO_WEB>
JWT_ACCESS_SECRET=<hex 32 bytes>
JWT_REFRESH_SECRET=<hex 32 bytes>
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=2592000
# R2 (uploads) — opcional
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=vetapp
S3_ACCESS_KEY_ID=<R2_ACCESS_KEY>
S3_SECRET_ACCESS_KEY=<R2_SECRET>
S3_FORCE_PATH_STYLE=true
# Google OIDC — opcional
GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
# Super-admin da plataforma (doc 15) — opcional. Se ambos setados, o boot cria/garante
# esse admin (idempotente). SEGREDO só aqui, NUNCA no repo. Senha ≥ 12 chars.
PLATFORM_BOOTSTRAP_EMAIL=<email-do-dono>
PLATFORM_BOOTSTRAP_PASSWORD=<senha-forte>
# Redis — opcional
# REDIS_URL=redis://<REDIS_HOST>:6379
```

Segredos JWT: `openssl rand -hex 32`. Healthcheck do Coolify: `GET /api/health`.
**Bootstrap do super-admin**: setar `PLATFORM_BOOTSTRAP_EMAIL`/`PASSWORD` cria o dono
da plataforma no próximo boot (o login exige MFA no 1º acesso — doc 15). Trocar a
senha na ENV propaga no boot seguinte.
Docs OpenAPI (`/api/docs`) ficam **desabilitados** quando `NODE_ENV=production`
(nenhuma rota a mais exposta — doc 02); o contrato segue gerado offline por
`openapi:gen`. Para expor a parceiros, publicar atrás de proxy/authz.

## ENVs — Web

`NEXT_PUBLIC_*` são embutidas no **build** → configurar como **build args** no
Coolify (não bastam em runtime).

```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://<DOMINIO_API>
# opcional (Google):
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
```

## Rede e domínios

- `https://<DOMINIO_API>` → resource API (porta 3000).
- `https://<DOMINIO_WEB>` → resource Web (porta 3000).
- Postgres/Redis **sem** porta pública; só rede interna do Coolify.
- `CORS_ORIGINS` (API) = domínio do Web; `NEXT_PUBLIC_API_URL` (Web) = domínio da API.
- **Cloudflare + subdomínio de 2 níveis** (`api.app.dominio.com`): o Universal SSL
  grátis só cobre 1 nível (`*.dominio.com`) → `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`.
  Solução: registro **DNS only** (nuvem cinza) para o Let's Encrypt do Coolify
  emitir o cert, ou usar subdomínio de 1 nível.

## Troubleshooting (aprendido no primeiro deploy real)

| Sintoma | Causa | Fix |
|---------|-------|-----|
| Build: `open Dockerfile: no such file` | Dockerfile Location no padrão `/Dockerfile` | apontar `/apps/api/Dockerfile` ou `/apps/web/Dockerfile` |
| Build: `nest: not found` / `next` ausente | Coolify injeta `NODE_ENV=production` no build → pnpm pula devDeps | resolvido no Dockerfile (`NODE_ENV=development pnpm install`) |
| Build morre **sem mensagem**, exit 255, progresso cortado | OOM/pico de recurso no VPS (checar `df -h /` e `free -m` de dentro de qualquer container) | re-tentar; adicionar **swap** (`fallocate -l 2G /swapfile ...`) — VPS compartilhado sem swap mata builds |
| API: `getaddrinfo EAI_AGAIN <host>` | hostname do Postgres errado na env (ex.: **letra O × zero**) ou fora da rede | **copiar/colar** a "Postgres URL (internal)" (nunca redigitar); validar com `getent hosts <host>` no Terminal da API |
| Browser: "CORS error" (sem status) | resposta não veio do Nest (Traefik 502 com API caída) ou origin `www` fora do `CORS_ORIGINS` | subir a API; incluir variantes www/não-www no `CORS_ORIGINS` |
| Register 500 com body válido | DTO de entrada **sem class-validator** + `ValidationPipe whitelist:true` remove tudo → `undefined` na query | todo DTO com `@Body` precisa de validadores (ver doc 12 §7) |
| Pre-deployment "Skipping" | comando pre-deploy roda no container **antigo**; se está morto, pula | rodar `node dist/database/migrate.js` no Terminal da API após subir |
