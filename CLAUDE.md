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
- **Doc 13 (complementares) completo**: Financeiro fase 2, Fiscal, Site, Portal
  do tutor — todos com MVP entregue. Próximas frentes são aprofundamentos (fase 3+).
- **Site público MVP feito** (doc 13 §4.2): CMS-lite por tenant (`site_config`,
  tabela global — leitura pública por slug; edição por `tenant_id`) e **solicitação
  de agendamento** (`agendamento_solicitacoes`, RLS) — a clínica confirma, nada
  grava direto na agenda. Público: `/clinica/[slug]` + `GET/POST /api/public/clinica/:slug`
  (única rota anônima de escrita — honeypot + rate limit por IP+slug). Gestão em
  `/site` (admin/gestor): CMS + triagem. **Conversão solicitação→cliente feita**
  (migração 0028): `POST /api/site/solicitacoes/:id/converter` cria o responsável
  (nome/telefone/email/origem) + o pet (se `petNome`), liga `responsavel_id` na
  solicitação e marca confirmada; UI abre a ficha do novo cliente. Pendente:
  agendamento em tempo real, Google Agenda/IA, rate limit distribuído.
- **Fiscal MVP feito** (doc 13 §3.3, provider-agnostic): config do emitente por
  tenant (`fiscal_config`, RLS) e ciclo da nota (`notas_fiscais`, RLS) a partir da
  fatura (`rascunho→emitida→cancelada`). **Provedor pluggável** (`FiscalProvider` +
  factory) — driver **`manual`** (numeração própria pela série); externos recusam
  explícito até plugar. Restrito a admin/gestor/financeiro (`/fiscal`). Nº da NFS-e
  aparece na 2ª via do Portal. **SEM segredos no banco** (certificado/credenciais →
  cofre). Pendente (requer decisão externa): integração real com provedor/prefeitura/
  SEFAZ, certificado A1, regras tributárias por item, PDF/XML no storage, webhook.
- **Portal do tutor MVP feito** (doc 13 §5.3): área logada do cliente em `/portal/*`
  com **auth separada da gestão** (`tutor_credentials` global sem RLS; token
  `scope:'tutor'`; `JwtAuthGuard` recusa tokens com scope, `TutorGuard` só aceita
  `'tutor'`). Onboarding **por convite** da clínica (link na ficha do cliente →
  tutor cria senha). Tutor vê **meus pets** (vacinas + histórico resumido, sem
  `observacao`), **agendamentos** (só leitura) e **faturas** (2ª via). Pagamento
  online/fiscal e agendamento online ficam para depois. **Refresh do tutor agora é
  stateful** (rotação por family + detecção de reuso + revogação, `tutor_refresh_tokens`,
  migração 0026 — mesmo padrão da gestão; `/portal/logout` revoga a family).
- **Financeiro fase 2 feito**: recebimento parcial (`recebimentos`, status
  derivado), formas de recebimento (taxa em bps, em `/cadastros`), saldo do
  cliente (`/api/financeiro/saldos`, `/saldos`).
- **Segurança fase 2 feita** (doc 02 §2.2/§2.3): **refresh token stateful com
  rotação por *family* + detecção de reuso** (`refresh_tokens`, `/auth/refresh`,
  `/auth/logout`; renovação proativa no front) e **recovery codes de MFA**
  (`mfa_recovery_codes`, `/auth/mfa/recovery-codes`, aceitos no `/auth/mfa/verify`;
  UI em `/configuracoes`). Tabelas globais sem RLS (escopo por `jti`/`user_id`).
- **Baixa automática de estoque feita** (doc 13 §2): o evento do prontuário passa a
  referenciar um item do catálogo (`item_id` + `quantidade`, migração 0025). Ao
  registrar, se o item é estocável (produto/medicamento/vacina) e há saldo, gera
  `saida` no estoque automaticamente (mesma regra da internação; não bloqueia o
  registro clínico se faltar saldo — sinaliza `estoqueBaixado:false`). `item_id`
  também vai ao `fatura_itens` (comissão). UI: picker de catálogo + quantidade na
  ficha do animal.
- **MFA obrigatório por papel feito** (doc 02 §2.2): papéis sensíveis (admin/gestor/
  financeiro) não recebem sessão sem 2º fator. Login devolve `mfaSetupRequired` +
  `mfaSetupToken` (escopo `mfa_setup`, 15 min) → `POST /auth/mfa/forced-setup` +
  `/forced-enable` (liga MFA, emite recovery codes E a sessão). `JwtAuthGuard` recusa
  o token de setup como sessão. Front força o passo (QR → recovery codes) no login.
- **Histórico/vigência de preços feito** (doc 13 §2): tabela `preco_historico`
  (migração 0027, RLS fail-closed). Cada linha é um preço vigente a partir de
  `vigente_desde` (quem alterou + quando). `catalogo.create` grava a vigência inicial;
  `catalogo.update` grava nova vigência quando o `precoCentavos` muda. `GET
  /api/catalogo/:id/precos` lista o histórico. UI em `/precos`: alterar preço (gera
  vigência) + modal de histórico.
- **Exportação LGPD do titular feita** (doc 09 §5, doc 02 §6): `GET
  /api/lgpd/clientes/:responsavelId/export` (admin/gestor, auditado `lgpd.exportar`) —
  JSON agregado (cadastro + pets/prontuário + faturas/itens/recebimentos + agendamentos)
  sob `withTenant`+RLS, sem chaves internas. UI: botão "Exportar (LGPD)" na ficha do
  cliente. Atende acesso + portabilidade. Pendente: exclusão/anonimização, retenção.
- **Revogação + limpeza de sessões feita** (doc 02 §2.3): `SessionsService` (global) —
  reset de senha e desativação de usuário revogam as famílias de refresh da gestão;
  limpeza periódica (boot + 24h via `setInterval`, sem scheduler) apaga refresh
  expirados (gestão e tutor), preservando os revogados ainda válidos (detecção de reuso).
- Fase 2 documentada (pendente): migração de token para cookie httpOnly/BFF, denylist
  de access token (Redis), WebAuthn.
- **CRUD de Usuários e Acessos feito** (doc 07 §3.1): `/api/usuarios` (admin) +
  UI em `/configuracoes` — criar (senha temporária ou vincular existente), papel,
  ativar/desativar, reset de senha, remover acesso; travas anti-lockout (não mexe
  em si mesmo nem no último admin).
- **Seed de demonstração** (`apps/api/src/database/seed.ts`, `pnpm --filter
  @vetapp/api db:seed` / `node dist/database/seed.js`): clínica-demo completa e
  idempotente para apresentação (tenant separado, login `ana@vetexemplo.demo`).
- **Log de auditoria LGPD feito** (doc 02 §6, doc 07 §3.2): `audit_log` **append-only
  por tenant** — imutabilidade no banco (policies RLS só de SELECT/INSERT → sem policy
  de UPDATE/DELETE, RLS default-deny bloqueia para qualquer papel; + `REVOKE
  UPDATE/DELETE` de `vetapp_app` = erro duro em prod). `AuditService.registrar(tenantId,
  …)` best-effort (nunca quebra a ação de negócio) grava nas escritas sensíveis: auth
  (login/logout/register), usuários/acessos, fiscal (emitir/cancelar) e financeiro
  (receber). `GET /api/auditoria` (admin, paginado + filtro) e página `/auditoria` (só
  leitura). Append-only coberto por `tenant-isolation.spec.ts` (roda na CI).
- **Upload do logo da clínica feito** (doc 10 §3, doc 03 §5): tabela de domínio
  `tenant_branding` (migração 0024, RLS fail-closed — branding NÃO é público, ao
  contrário do `site_config`). Logo no **R2** (bucket privado, só `logo_key` no banco
  → URL assinada, nunca proxia bytes). `/api/branding`: `GET` (qualquer membro, p/
  renderizar) + `POST logo/sign-upload` · `POST logo` · `DELETE logo` (**admin**,
  auditados). UI em `/configuracoes` (preview + upload + remover) e logo no cabeçalho
  da sidebar. Pendente: cor primária por tenant; reuso em documentos impressos quando
  existirem (o `GET /api/branding` já atende).

## Regra viva

Quando aparecer uma questão **estrutural** (arquitetura, deploy, segurança, CI),
atualizar o **blueprint** (`docs/blueprint`) e a SPEC relevante — decisão registrada,
não só aplicada.
