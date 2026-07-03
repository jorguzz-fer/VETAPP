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

Rodar a cada deploy com migration nova (usa `DATABASE_ADMIN_URL`):

```
pnpm --filter @vetapp/api db:migrate
```

Recomendado como **pre-deploy command** da API no Coolify.

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
# Redis — opcional
# REDIS_URL=redis://<REDIS_HOST>:6379
```

Segredos JWT: `openssl rand -hex 32`. Healthcheck do Coolify: `GET /api/health`.
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
