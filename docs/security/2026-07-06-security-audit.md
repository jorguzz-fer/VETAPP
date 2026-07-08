# Security Audit — VETAPP — 2026-07-06

Stack: monorepo pnpm · **apps/api** NestJS 10 + Drizzle + Postgres (Argon2id, JWT access/refresh, MFA TOTP, Google OIDC) · **apps/web** Next.js 15 / React 19 · multi-tenant por **RLS** · infra Coolify/R2.
Playbook de referência: `vibesec` (agnóstico). O playbook Next+Prisma não se aplica (API é NestJS+Drizzle).
Método: varredura por 4 subagentes (auth, RLS, controllers, web/infra) + leitura dos arquivos-crux. Cada achado confirmado em código.

**Achados: 🔴 2 crítico · 🟠 4 alto · 🟡 4 médio · 🟢 6 baixo**

> Veredito: **fundação de segurança excelente** — RLS impecável, secrets bem tratados, OIDC/reset/rotação-de-refresh corretos, Dockerfiles e CI sãos. Mas há **dois furos sérios no controle de acesso e no anti-brute-force** que precisam ser fechados antes de produção. Vários itens 🟠/🟡 já estão listados como follow-up no próprio `CLAUDE.md`.

---

## O que já está CORRETO (verificado, não mexer)

- **Isolamento de tenant por RLS — impecável.** 20/20 tabelas de domínio com `ENABLE`+`FORCE ROW LEVEL SECURITY` e policy fail-closed `NULLIF(current_setting('app.current_tenant',true),'')::uuid`. `tenantId` sempre derivado do JWT verificado (nunca do client). Role `vetapp_app` é `NOBYPASSRLS/NOSUPERUSER`. `withUser` só no login. **Zero SQLi** (só Drizzle + um `set_config` parametrizado).
- **Rotação de refresh da gestão** com reuse-detection (apresentar `jti` revogado mata a família inteira). Logout revoga server-side.
- **Isolamento de escopo de token** — guard rejeita tokens `mfa`/`tutor` em rotas da gestão; `TutorGuard` aceita só `scope:'tutor'`. Sem bypass "sessão antes do MFA".
- **Google OIDC** verificado server-side (assinatura + audience), não é decode cru.
- **Reset por convite (portal)** — token 256-bit, SHA-256, uso único, expiry 7d; login sem enumeração.
- **IDOR no portal do tutor** corretamente bloqueado (checa `responsavelId` antes de retornar pet/fatura).
- **ValidationPipe global** `whitelist:true` (mata mass assignment) · **CORS** por allowlist de env (não `*`) · **Swagger off em produção** · **secrets JWT obrigatórios** (fail-fast, sem default) · **Dockerfiles non-root** · **CI** sem vazamento de secret · **storage** presigned (sem SSRF, keys por tenant) · **inteligencia** read-only tenant-scoped.

---

## 🔴 Crítico

### C1. RBAC existe mas não é aplicado — escalonamento vertical de privilégio
- **Onde:** `RolesGuard` só está plugado em 2 de 18 controllers (`fiscal.controller.ts:20`, `site.controller.ts:22`). Todos os demais usam só `@UseGuards(JwtAuthGuard)`, e os services não têm checagem de papel.
- **Evidência:** papéis definidos (`memberships.ts:16`): `admin|gestor|recepcao|veterinario|internacao|financeiro`. Nenhum é verificado em `financeiro`, `comissoes`, `estoque`, `vendas`, `internacao`, `catalogo`, `clientes`, `portal-admin`.
- **Risco:** um usuário logado de baixo privilégio (ex.: `recepcao`, `veterinario`) pode chamar `POST /faturas/:id/pagar`, `POST /faturas/:id/recebimentos`, `POST /comissoes/regras` (**definir a própria comissão**), `POST /estoque/movimentos` (ajuste arbitrário de estoque), `DELETE /clientes/:id`, `POST /clientes/:id/portal/convite` (emitir convites). RLS **não** protege aqui — é mesmo tenant, escalonamento vertical (OWASP A01). Financeiramente material.
- **Correção:** aplicar `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` em todo controller privilegiado — o mecanismo já existe e funciona (ver `fiscal.controller.ts`). Precisa definir a matriz papel→ação por endpoint. Ver `vibesec` › Access Control (vertical access).

### C2. MFA brute-forçável + rate limit ausente em toda a autenticação
- **Onde:** `auth.controller.ts` (login, google, mfa/verify, refresh, register), `portal.controller.ts` (login, convite/aceitar). Sem `@nestjs/throttler` no projeto — o único rate limiter (`site/rate-limiter.ts`, em memória) serve **apenas** a rota pública do site.
- **Evidência:** `mfaVerify` (`auth.service.ts:148-168`) valida o `mfaToken` (TTL 5min) e chama `authenticator.check(code, secret)` **sem** contador de tentativas, lockout ou consumo de step. O `mfaToken` pode ser reusado até expirar.
- **Risco:** quem tem credencial válida (logo, um `mfaToken`) dispara ~10⁶ requisições contra `/auth/mfa/verify` na janela de 5min → **o segundo fator cai por força bruta**. Somado: credential stuffing ilimitado no login e criação em massa de tenant via `/auth/register`.
- **Correção:** instalar `@nestjs/throttler` global + limites apertados em `/auth/*` e `/portal/login`; contador de tentativas + lockout no MFA; marcar o step do TOTP como consumido (anti-replay). Ver `vibesec` › Password Security / API Security.

---

## 🟠 Alto

### A1. Sem account lockout após N falhas de login
- **Onde:** `auth.service.ts:87-97`, `portal-auth.service.ts:141-156`. Sem `failedLoginCount`/`lockedUntil`. Só o custo do Argon2id limita a taxa. Ver C2.

### A2. TOTP sem consumo de step (replay dentro da janela)
- **Onde:** `auth.service.ts:162` — `authenticator.check` sem guardar o último step consumido. Um código observado/phishado vale por toda a janela de 30s (±1). (Recovery codes, esses sim, são uso-único — corretos.)

### A3. Algoritmo do JWT não fixado na verificação
- **Onde:** todos os `jwt.verifyAsync` passam só `{ secret }`, sem `algorithms: ['HS256']` (`jwt-auth.guard.ts:38`, `auth.service.ts:151/181/211`, `tutor.guard.ts:41`, `portal-auth.service.ts:161`).
- **Risco:** com HMAC o `alg:none` já é rejeitado, mas não fixar o algoritmo é brecha de defense-in-depth e reabre alg-confusion se um dia migrarem para chave RS/ES. Correção trivial: pinar `algorithms:['HS256']`.

### A4. Tokens (incl. refresh) entregues no body e guardados em `localStorage`
- **Onde:** `auth.controller.ts` retorna `{accessToken,refreshToken}` no body; `apps/web/src/lib/api.ts:9-21` + `portalApi.ts` + `AuthProvider.tsx:55` persistem em `localStorage`.
- **Risco:** qualquer XSS no web lê o refresh (30 dias) e resulta em **takeover de ~30 dias**, sobrevivendo ao fechar a aba. `httpOnly` cookie neutralizaria.
- **Nota:** já listado como follow-up no `CLAUDE.md` ("migração para cookie httpOnly/BFF"). A CSP (M3) é a mitigação principal enquanto isso não vem.

---

## 🟡 Médio

### M1. Refresh do portal (tutor) sem rotação nem revogação
- **Onde:** `portal.controller.ts:65-69` — `logout()` retorna `{ ok: true }` e não faz nada server-side; refresh do tutor é stateless. Token roubado vale até expirar. Já é follow-up conhecido. (A gestão, essa, é correta.)

### M2. Refresh TTL de 30 dias
- **Onde:** `env.ts:18-19` — access 15min (bom), refresh 2592000s (30d). Amplia a janela de um token vazado; agrava A4.

### M3. Sem CSP/security headers no app web
- **Onde:** `apps/web/next.config.ts` — sem `headers()`, sem CSP, sem `X-Frame-Options`/HSTS/`Referrer-Policy`. O `helmet()` da API **não** cobre o HTML do Next (server separado). É a defesa-em-profundidade que falta contra o XSS→token de A4.
- **Correção:** bloco `async headers()` com CSP + framing + HSTS.

### M4. Enumeração de usuário no `register`
- **Onde:** `auth.service.ts:68-69` — `409 "E-mail já cadastrado"` distingue e-mails existentes. (Os logins, esses, têm resposta genérica — corretos.)

---

## 🟢 Baixo

- **B1.** Recovery codes de 32 bits (`auth.service.ts:383`) — hashed + uso único, mas recomenda-se ≥64 bits.
- **B2.** `SignLogoDto.contentType` sem whitelist (`site.dto.ts:194`) — admin pode presign `image/svg+xml`/`text/html`; outros uploads whitelistam corretamente. Uploads são presigned-direct-to-S3 (API não vê bytes) → sem validação de magic-byte/tamanho em nenhum path.
- **B3.** Fallback hardcoded de admin-DB em `apps/api/src/database/migrate.ts:12` (`...vetapp_admin:admin_password@localhost...`) — só CLI de migration, credencial local; prefira exigir a env.
- **B4.** Job `security` da CI com SCA + gitleaks como `echo "TODO"` — plugar o secret-scanning de verdade.
- **B5.** (defense-in-depth, by design) 3 tabelas globais (`tutor_credentials`, `refresh_tokens`, `site_config`) sem backstop RLS — hoje filtradas corretamente no código, mas um `WHERE tenant_id` esquecido no futuro vazaria (nas 20 tabelas RLS, falharia fechado).
- **B6.** (informativo) Proteção de rota no web é client-side (UX) — aceitável porque a authz real é server-side, mas não há `middleware.ts`.

---

## Ordem sugerida de remediação

1. **C1** — aplicar `RolesGuard`+`@Roles` nos controllers privilegiados (exige definir a matriz papel→ação; maior impacto de segurança).
2. **C2/A1/A2** — `@nestjs/throttler` global + lockout + anti-replay do MFA.
3. **A3** — pinar `algorithms:['HS256']` (trivial).
4. **M3** — CSP/headers no `next.config.ts` do web.
5. **A4/M1** — migração para cookie httpOnly + refresh revogável no portal (já no radar do time).
6. **M2/M4** — reduzir refresh TTL; resposta genérica no register.
7. **B1–B6** — conforme prioridade; B4 (secret-scanning na CI) é barato e vale.

> Prioridade real antes de produção: **C1 e C2**. O resto é hardening incremental — e boa parte (A4/M1) o `CLAUDE.md` já reconhece como pendente.
