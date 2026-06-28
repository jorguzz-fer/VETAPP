# @vetapp/api

Backend do VETAPP — **NestJS + Drizzle + PostgreSQL (RLS)**. Implementa o esqueleto
de autenticação e o padrão multitenant descritos na SPEC (`docs/spec/`).

## Pré-requisitos
- Node 20+, pnpm 9+, Docker (para a infra local).

## Subir o ambiente

```bash
# 1) Infra local (Postgres + Redis + MinIO)
pnpm infra:up

# 2) Variáveis de ambiente
cp .env.example .env        # ajuste se necessário

# 3) Dependências
pnpm install

# 4) Migrations (aplica schema + políticas RLS, como usuário admin)
pnpm db:migrate

# 5) API em modo dev
pnpm dev:api
```

API em `http://localhost:3000` · OpenAPI em `http://localhost:3000/api/docs`.

## Fluxo de autenticação (scaffold)

```bash
# Cria tenant + usuário admin + membership e devolve tokens
curl -X POST http://localhost:3000/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"tenantName":"Clínica Cuidar","email":"dono@clinica.com","name":"Maria","password":"senha-forte"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"dono@clinica.com","password":"senha-forte"}'

# Rota protegida (use o accessToken retornado)
curl http://localhost:3000/api/auth/me -H 'authorization: Bearer <accessToken>'
```

## Multitenancy + RLS (resumo)
- O usuário da aplicação (`vetapp_app`) **não** tem `BYPASSRLS`.
- Operações escopadas a um tenant passam por `DatabaseService.withTenant(tenantId, ...)`,
  que abre transação e fixa `app.current_tenant` (`SET LOCAL`).
- As políticas RLS (migração `0000_init.sql`) filtram por esse setting → isolamento
  garantido no banco, não só no código. Ver `docs/spec/03-multitenancy.md`.

## Estrutura
```
src/
├─ config/        # validação de env (zod) + provider ENV
├─ database/      # Drizzle: schema, service (tenant context), migrations, migrate
├─ common/guards/ # JwtAuthGuard (authn) + RolesGuard (RBAC)
└─ modules/
   ├─ health/     # liveness público
   └─ auth/       # register/login (argon2 + JWT) — esqueleto
```

## Escopo deste scaffold (e o que falta)
✅ Boot da API, config validada, Drizzle + RLS, auth básica (register/login/me),
health, OpenAPI, CI, Docker.
🔜 Próximas iterações: refresh token rotativo + revogação, **MFA (TOTP/WebAuthn)**,
login Google (OIDC), OAuth2 para a API externa (doc 11), escopos, Testcontainers
para o teste de isolamento de tenant (doc 12), módulos de domínio (clientes,
animais, prontuário…).
