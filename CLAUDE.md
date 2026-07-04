# CLAUDE.md — VETAPP

Guia para agentes/sessões do Claude Code neste repo. Leia isto **antes** de mexer.
O detalhe mora em `docs/spec/*` (a SPEC) e `docs/blueprint/engineering-blueprint.md`
(boas práticas reutilizáveis). Este arquivo resume o que é **load-bearing**.

## O que é

VETAPP — gestão de clínica veterinária. Desktop + mobile (web responsivo), com
APPs nativos iOS/Android previstos para o futuro. **MultiTenant**, **API-first**
(parceiros externos no escopo), segurança de altíssimo nível: **autenticação
sempre server-side, nenhuma rota exposta à toa**.

## Stack e estrutura

Monorepo **pnpm workspaces**:
- `apps/api` — **NestJS 10** + **Drizzle ORM** + Postgres. OpenAPI via `@nestjs/swagger`.
- `apps/web` — **Next.js 15 / React 19 / Tailwind 4**. Base visual: template **Trezo**.
- `packages/api-client` — cliente tipado (`openapi-fetch` + `openapi-typescript`).
- `packages/design-tokens` — tokens compartilháveis (web e futuro app nativo).
- `infra/` — `docker-compose.yml` (dev), `postgres-init/` (papel de app).

Infra alvo: **VPS Hostinger + Coolify (Docker)**; storage **Cloudflare R2**
(S3-compatível). Deploy: ver `docs/spec/14-deploy-coolify.md`.

## Convenções que NÃO se quebra

1. **Multitenancy por RLS** (`docs/spec/03`). Toda tabela de domínio tem `tenant_id`
   + `ENABLE`/`FORCE ROW LEVEL SECURITY` + policy fail-closed:
   `USING/WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)`.
   O `NULLIF` é obrigatório: GUC não setado vira `''`, e `''::uuid` explode (fail-open).
   A app conecta como **`vetapp_app`** (`NOBYPASSRLS`/`NOSUPERUSER`); migrations rodam
   como admin. Acesso a dados sempre via `DatabaseService.withTenant(tenantId, fn)`.
2. **Dinheiro em centavos** (inteiro). Nunca float.
3. **OpenAPI é a fonte da verdade** do contrato. Fluxo ao mudar rotas/DTOs:
   `pnpm --filter @vetapp/api openapi:gen` (roda `nest build && node dist/openapi.js`
   — precisa do build compilado por causa do decorator metadata) →
   `pnpm --filter @vetapp/api-client gen` (gera `schema.d.ts`). Commitar ambos.
4. **Auth server-side**: Argon2id, JWT access/refresh, MFA TOTP, Google OIDC
   verificado no servidor. `/api/docs` (Swagger) fica **desabilitado em produção**.
5. **Migrations**: SQL escrito à mão em `apps/api/src/database/migrations/NNNN_*.sql`
   + **atualizar `meta/_journal.json`** (nova entrada com idx/tag/when). Cada policy
   RLS nova segue o padrão `NULLIF`.
6. **Faturamento acoplado**: evento clínico com valor → item na fatura ABERTA do
   responsável (`prontuario.service.ts`).

## Como validar (rode antes de commitar)

Por app: `pnpm --filter @vetapp/api typecheck|lint|test|build` e
`pnpm --filter @vetapp/web typecheck|lint|build`. Se mexeu em rotas de web e o
typecheck reclamar de `.next/types` obsoleto: `rm -rf apps/web/.next` antes.
O teste **autoritativo** de isolamento é `apps/api/test/tenant-isolation.spec.ts`
(Testcontainers + Postgres real; pula localmente sem Docker, **roda na CI**).

## Fluxo de trabalho (Git/PR)

- Uma branch **por tópico** `claude/<assunto>-cjqp7e`, PR para **`main`**, squash-merge.
- **Merge dirigido por sequência**: PRs que criam migration são mergeados **um de
  cada vez** para não colidir número de migration entre branches paralelas.
- CI é o gate (`.github/workflows/ci.yml`): jobs `api` (typecheck·lint·migrate·test·
  build com Postgres + Testcontainers) e `web` (typecheck·build). Merge quando verde.
- **Atenção — PRs-fantasma**: a plataforma abre automaticamente PRs da branch de
  trabalho (e de `main`) contra a branch designada `claude/app-spec-security-cjqp7e`,
  que está desatualizada e gera "conflitos" artificiais. O PR **correto** é sempre o
  que aponta para `main`. Fechar os fantasmas.
- Segredos (JWT, senha do `vetapp_app`, chaves R2) **nunca** no repo — só nas ENVs
  do Coolify. Docs de deploy usam placeholders.

## Status dos módulos (fase 1) — em `main`

Feito: scaffolds (api/web), clientes & animais, prontuário + faturamento acoplado,
signup/cadastro, agenda, storage R2 (foto + anexos), catálogo/tabela de preços,
MFA + Google, financeiro (faturas + baixa), estoque (saldo/movimentações/mínimo),
internação (admissão → mapa de execução com baixa de estoque + faturamento
automáticos → alta; faturamento compartilhado via `FaturamentoService`),
agenda avançada (tipos de atendimento com duração/cor em `/cadastros`,
profissional por agendamento, "minha agenda", status), vendas/orçamentos
(acoplado à ficha do cliente, itens por código, converter → fatura aberta),
comissionamento (regras % por colaborador/item em basis points, profissional
gravado no `fatura_itens`, fechamento + "minhas comissões"), **painel por
persona** (`/api/dashboard`, KPIs reais recortados por papel) e **produtividade**
(`/api/inteligencia/produtividade`, produção por colaborador). **Fase 1 do
mapeamento (doc 05) completa** — restam os complementares do doc 13.
**App em produção** (Coolify/VPS): runbook e troubleshooting em `docs/spec/14`.

Pendências conhecidas:
- **Branch protection** em `main` (ação manual no GitHub UI — exigir PR + checks
  `API (lint · types · test · build)` e `Web (typecheck · build)`).
- Próximos módulos do mapa (`docs/spec/13`): **Fiscal**, **Site**.
- **Portal do tutor MVP feito** (doc 13 §5.3): área logada do cliente em `/portal/*`
  com **auth separada da gestão** (`tutor_credentials` global sem RLS; token
  `scope:'tutor'`; `JwtAuthGuard` recusa tokens com scope, `TutorGuard` só aceita
  `'tutor'`). Onboarding **por convite** da clínica (link na ficha do cliente →
  tutor cria senha). Tutor vê **meus pets** (vacinas + histórico resumido, sem
  `observacao`), **agendamentos** (só leitura) e **faturas** (2ª via). Pagamento
  online/fiscal e agendamento online ficam para depois. Refresh do tutor é
  stateless por ora (follow-up: rotação/revogação como na gestão).
- **Financeiro fase 2 feito**: recebimento parcial (`recebimentos`, status
  derivado), formas de recebimento (taxa em bps, em `/cadastros`), saldo do
  cliente (`/api/financeiro/saldos`, `/saldos`).
- **Segurança fase 2 feita** (doc 02 §2.2/§2.3): **refresh token stateful com
  rotação por *family* + detecção de reuso** (`refresh_tokens`, `/auth/refresh`,
  `/auth/logout`; renovação proativa no front) e **recovery codes de MFA**
  (`mfa_recovery_codes`, `/auth/mfa/recovery-codes`, aceitos no `/auth/mfa/verify`;
  UI em `/configuracoes`). Tabelas globais sem RLS (escopo por `jti`/`user_id`).
- Fase 2 documentada (pendente): histórico/vigência de preços, baixa automática de
  estoque (exige evento do prontuário referenciar item de catálogo), **MFA
  obrigatório por papel**, migração de token para cookie httpOnly/BFF, WebAuthn.

## Regra viva

Quando aparecer uma questão **estrutural** (arquitetura, deploy, segurança, CI),
atualizar o **blueprint** (`docs/blueprint`) e a SPEC relevante — decisão registrada,
não só aplicada.
