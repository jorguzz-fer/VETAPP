# 15 — Admin da Plataforma (SaaS back-office)

> **Status: MVP implementado (Stages 1–3).** Módulo do **dono do
> SaaS** (Fernando Jorge) — assinaturas, adesões, gestão de clínicas e visão
> consolidada. É o único ator que legitimamente **cruza tenants**; por isso o modelo
> de segurança é o ponto mais sensível deste doc. Diretriz do stakeholder (doc 02)
> continua valendo em dobro aqui: **auth sempre server-side, nenhuma rota exposta à toa**.
>
> **Stage 1 entregue (auth da plataforma)**: tabelas globais `platform_admins`,
> `platform_refresh_tokens`, `platform_mfa_recovery_codes` e `platform_audit_log`
> (append-only, migração 0030). `PlatformAuthService` com **login + MFA obrigatório**
> (setup forçado), **refresh stateful** (rotação + reuso + revogação) e escopo de token
> **`platform`** isolado (`PlatformGuard`); rotas `/api/platform/auth/*`. Bootstrap do 1º
> super-admin por ENV (`PLATFORM_BOOTSTRAP_EMAIL`/`PASSWORD`) no boot, idempotente.
> **Decisão de produto tomada**: inadimplência = **grace period → bloqueio** (§4.3).
>
> **Stage 2 entregue (assinaturas + gestão de clínicas)**: tabelas globais `planos` e
> `assinaturas` (migração 0031). `AssinaturasService` (`@Global`) com `avaliarAcesso`
> (grace period → bloqueio: suspensa/cancelada bloqueia; vencido dentro do grace de 7
> dias avisa; além do grace bloqueia), CRUD (definir plano, marcar pago, suspender,
> cancelar), KPIs (nº de clínicas, por status, MRR) e listagem de clínicas. **Login da
> gestão faz o enforcement** (`AuthService.resolveLogin` bloqueia antes do MFA). Planos
> padrão semeados no boot; self-signup entra em **trial**. Back-office em
> `/api/platform/*` (sob `PlatformGuard`, auditado): `clinicas`, `clinicas/:id/assinatura`
> (GET/PUT), `.../pagar`, `POST clinicas` (provisionar tenant+admin+trial), `planos`
> (CRUD), `kpis`.
>
> **Stage 3 entregue (front `/plataforma/*`)**: área **separada** do app da clínica e do
> portal — `PlatformAuthProvider` (login + MFA obrigatório com QR/recovery codes +
> refresh proativo, tokens em storage próprio) e `platformApi`. Telas: **`/plataforma/login`**,
> **`/plataforma`** (KPIs: nº de clínicas, ativas/trial/inadimplentes, MRR + tabela de
> clínicas com marcar pago / suspender-reativar / definir plano / provisionar) e
> **`/plataforma/planos`** (CRUD). **MVP fase 1 completo.** Pendente (externo/fase 2):
> gateway de pagamento (checkout + webhooks + dunning), impersonação assistida, quotas.

## 1. Por que existe (e o que NÃO é)

Hoje o VETAPP é multitenant, mas **não há um ator acima dos tenants**:

- O **"admin" do doc 07 é por clínica** (dono/gestor de *um* tenant, via `membership`).
  Nunca enxerga outra clínica — e assim deve continuar.
- Um **tenant nasce** só pelo `/cadastro` público (self-signup) ou pelo `seed`. Não
  há aprovação, provisionamento controlado, nem quem acompanhe a adesão.
- **Planos/quotas do doc 11** são da **API pública** como produto — **não** são a
  assinatura da clínica no SaaS.
- **Gateway de pagamento do doc 13** é a clínica cobrando o **tutor** — **não** a
  plataforma cobrando a **clínica**.

Este módulo preenche essa lacuna: o **back-office do provedor**. Escopo:
gestão de clínicas (tenants), **assinaturas/adesões**, cobrança do SaaS e métricas
de negócio (MRR, churn, inadimplência).

**Não** é um "admin com mais permissões" dentro de um tenant. É um **plano de controle
separado**, com identidade, autenticação, rotas e telas próprias.

## 2. Modelo de segurança (load-bearing)

O super-admin é um **alvo de altíssimo valor**: comprometê-lo é comprometer todos os
tenants. Regras:

1. **Identidade separada** — tabela **global** `platform_admins` (fora do `users` da
   gestão e do `tutor_credentials`). Sem RLS (é global por natureza), escopo por
   `id`/`email` no código. Argon2id, como o resto.
2. **Escopo de token próprio** — access token com `scope: 'platform'`. Os guards
   existentes **recusam por padrão**: `JwtAuthGuard` (gestão) já rejeita tokens com
   `scope`; `TutorGuard` só aceita `'tutor'`. Um novo `PlatformGuard` aceita **só**
   `'platform'`. Nenhum token da plataforma vira sessão de gestão/tutor e vice-versa.
3. **Refresh stateful** desde o início (rotação + reuso + revogação, como a gestão —
   doc 02 §2.2). Nada de refresh stateless aqui.
4. **MFA obrigatório** para todo platform-admin (não é opcional). Reaproveita o fluxo
   de setup forçado (doc 02 §2.2).
5. **Fora do RLS de tenant** — as leituras cruzam tenants **de propósito** (listar
   clínicas, somar MRR). Portanto **não** usam `withTenant`; usam `this.database.db`
   com queries explícitas nas tabelas globais (`tenants`, `platform_*`). **Nunca**
   leem tabelas de domínio de um tenant sem fixar o tenant — se precisarem (raro,
   ex.: suporte), fixam `app.current_tenant` **explicitamente** e a ação é auditada.
6. **Superfície mínima / namespace isolado** — todas as rotas sob **`/api/platform/*`**,
   idealmente atrás de **IP allow-list / rede administrativa** (doc 02 §4). O front do
   super-admin é uma área separada (**`/plataforma/*`**), nunca mesclada ao app da
   clínica.
7. **Auditoria própria** — toda ação do super-admin (criar/suspender tenant, mudar
   plano, marcar pagamento) grava em **`platform_audit_log`** (append-only, mesmo
   padrão imutável do doc 02 §6). Auditoria de tenant e de plataforma **não se
   misturam**.
8. **Bootstrap seguro** — o primeiro platform-admin não sai de rota pública. Nasce por
   **CLI/seed com segredo de ambiente** (`PLATFORM_BOOTSTRAP_*`), nunca por signup.

## 3. Modelo de dados (proposto)

Tudo global (sem RLS), dinheiro em **centavos**, datas em UTC.

- **`platform_admins`** — `id`, `email` (único), `nome`, `password_hash`,
  `mfa_enabled`, `mfa_secret`, `status` (`active|disabled`), `created_at`.
- **`platform_refresh_tokens`** — igual a `tutor_refresh_tokens`/`refresh_tokens`
  (jti, family, `admin_id`, `expires_at`, `revoked_at`, `replaced_by_id`).
- **`planos`** — catálogo de planos do SaaS: `id`, `nome`, `slug`, `preco_centavos`,
  `ciclo` (`mensal|anual`), `limites` (jsonb: ex. nº de usuários, storage), `ativo`.
- **`assinaturas`** — vínculo **tenant ↔ plano**: `id`, `tenant_id` (único por
  assinatura ativa), `plano_id`, `status` (`trial|ativa|inadimplente|cancelada|suspensa`),
  `ciclo`, `preco_centavos` (snapshot na adesão), `iniciada_em`, `vigente_ate`,
  `cancelada_em`, `trial_ate`, `observacao`.
- **`assinatura_eventos`** — trilha da assinatura (mudança de plano, pagamento
  marcado, suspensão): `id`, `assinatura_id`, `tipo`, `detalhe` jsonb, `criado_por`
  (platform_admin), `criado_em`. (Pode ser derivado do `platform_audit_log`.)
- **`platform_audit_log`** — `id`, `admin_id`, `acao`, `entidade`, `entidade_id`,
  `resumo`, `detalhe` jsonb, `ip`, `created_at`. Append-only (RLS só de SELECT/INSERT
  ou tabela global + REVOKE — mesmo racional do doc 02 §6).
- **(fase 2)** `pagamentos_saas` — cobranças/recibos por assinatura quando entrar o
  gateway (provider ref, valor, status, competência).

Relação: `tenants` (já existe) ganha, na prática, **uma** assinatura corrente. O
`status` da assinatura é a fonte da verdade para **suspensão de acesso** (§4.3).

## 4. Funcionalidades

### 4.1 Autenticação da plataforma
- `POST /api/platform/auth/login` (+ MFA obrigatório), `refresh`, `logout` — espelham
  a gestão, com `scope:'platform'` e `platform_refresh_tokens`.
- Sem self-signup. Gestão de outros platform-admins **por** um platform-admin.

### 4.2 Gestão de clínicas (tenants)
- **Listar** todos os tenants com status de assinatura, plano, adesão, último acesso,
  contagem de usuários. Busca/paginação.
- **Provisionar** uma clínica: cria `tenant` + primeiro admin (convite/senha temporária,
  reusa `usuarios`/`auth`) + **seed padrão** (tipos de atendimento, formas de
  recebimento etc. — doc 03 §5). Substitui o self-signup "solto" por um fluxo dono-
  dirigido (self-signup pode conviver, mas cria assinatura em `trial`).
- **Suspender / reativar** a clínica (muda `assinaturas.status`).
- **Detalhe** de um tenant: dados de adesão, histórico de assinatura, uso resumido.

### 4.3 Assinaturas / adesões
- **Fase 1 (manual)**: o platform-admin define o **plano** do tenant, marca
  **pago/inadimplente**, ajusta `vigente_ate`, aplica **trial**, **cancela**. Sem
  gateway — Fernando controla o ciclo na mão.
- **Efeito da suspensão/inadimplência no acesso** — **[A DEFINIR]** (decisão de
  produto): opções (a) **bloquear login** dos usuários do tenant; (b) **modo
  read-only**; (c) **grace period** + banner de aviso e depois bloqueio. Seja qual
  for, é aplicado **server-side** (o `login`/guards checam o status da assinatura do
  tenant), nunca só no front.
- **Fase 2 (gateway)**: Pix/cartão (Stripe/Asaas/Iugu — **[A DEFINIR]**), checkout
  self-service, webhooks de pagamento → atualizam `assinaturas`/`pagamentos_saas`,
  **dunning** (régua de inadimplência) automatizado. Segredos do gateway **só no
  cofre** (doc 02 §5), nunca no banco/repo.

### 4.4 Visão consolidada (métricas de negócio)
- KPIs cruzando tenants: **nº de clínicas** (ativas/trial/inadimplentes/canceladas),
  **MRR/ARR**, **novas adesões no mês**, **churn**, ticket médio. É o **único** lugar
  que agrega entre tenants — e por isso o mais auditado.

### 4.5 Suporte (fase 2+)
- **Impersonação assistida** para suporte (entrar num tenant como somente-leitura),
  com **consentimento/registro** e forte auditoria. Alto risco — só depois, e com
  trilha explícita.

## 5. Frontend
- Área separada em **`/plataforma/*`** (provider), com seu próprio `PlatformAuthProvider`
  e layout — desacoplada do app da clínica e do portal do tutor. Login próprio.
- Telas fase 1: login+MFA, **lista de clínicas**, **detalhe/assinatura** (definir plano,
  marcar pago/suspender), **dashboard de KPIs**, **auditoria da plataforma**.

## 6. Fases

- **Fase 1 (MVP, autônomo)**: auth super-admin (scope `platform` + MFA + refresh
  stateful), `platform_admins`/`platform_refresh_tokens`/`assinaturas`/`planos`/
  `platform_audit_log`, gestão de tenants (listar/provisionar/suspender), **assinatura
  manual**, KPIs consolidados, efeito de suspensão no login (definir a política em §4.3).
  **Não** depende de credencial externa.
- **Fase 2 (externo)**: gateway de pagamento (provider **[A DEFINIR]**), checkout,
  webhooks, dunning, recibos/NF do SaaS.
- **Fase 3**: impersonação assistida, planos com limites **enforced** (quotas),
  métricas avançadas (cohorts/LTV), self-service de upgrade/downgrade.

## 7. Decisões em aberto (**[A DEFINIR]** — dependem de você)
- **Catálogo de planos** (nomes, preços, ciclos, limites) e política de **trial**.
- **Comportamento na inadimplência/suspensão** (bloqueio × read-only × grace period).
- **Provedor de pagamento** do SaaS (Stripe/Asaas/Iugu/Pix direto) — fase 2.
- **Convivência com o self-signup atual** (manter, moderar, ou exigir aprovação?).
- **Residência/segregação** do plano de controle (IP allow-list, subdomínio próprio
  ex.: `admin.vetapp...`).

## 8. Convenções herdadas (não repetir errado)
- Dinheiro em **centavos**; OpenAPI é a fonte da verdade; migrations SQL à mão +
  `_journal.json`; auth server-side; segredos fora do repo.
- Tabelas da plataforma são **globais** — seguem o padrão de `users`/`refresh_tokens`
  (sem RLS, escopo no código), **não** o padrão RLS-por-tenant das tabelas de domínio.
- Append-only da auditoria segue a lição do blueprint §7 (policies só SELECT/INSERT +
  REVOKE) — vale para `platform_audit_log`.
