# 11 — API pública e integrações externas (API-first)

> Diretriz: **"disponibilizar tudo em API também, para conectar o VETAPP com
> outras aplicações."** Este documento define a **API como produto**: como
> terceiros (ou outras aplicações do próprio dono) consomem o VETAPP de forma
> segura, sem ferir o princípio "nenhuma rota aberta" (doc 02).

## 1. Princípio: API-first, exposta porém nunca "aberta"

- **Toda funcionalidade nasce na API** (`/api/v1`, OpenAPI como fonte de verdade).
  Web, mobile, apps nativos **e aplicações externas** consomem a mesma API.
- "Exposta" ≠ "aberta": **todo** endpoint exige **credencial válida + escopo +
  tenant**. Não existe rota anônima de negócio. Isso reconcilia a abertura para
  terceiros com a diretriz de segurança (doc 02 §4).
- Reúso, não duplicação: o que o front faz, um parceiro também faz — pelas mesmas
  regras de autorização server-side.

## 2. Dois planos de acesso

| Plano | Quem | Autenticação | Uso |
|-------|------|--------------|-----|
| **First-party** | Web/PWA/app nativo do VETAPP | Sessão (cookie httpOnly) / OIDC + refresh (doc 02) | UI dos nossos clientes |
| **Third-party (M2M)** | Outras aplicações, integrações, parceiros | **OAuth2 Client Credentials** (ou Authorization Code + PKCE quando age em nome de um usuário) | Conectar o VETAPP a sistemas externos |

A mesma API serve os dois; muda só **como o chamador se autentica** e **quais
escopos** ele possui.

## 3. Autenticação de aplicações (machine-to-machine)

- **OAuth2 Client Credentials** para integrações servidor-a-servidor (app do dono,
  ERP, BI, automações). Cada aplicação tem `client_id` + `client_secret`
  (rotacionável), emite **access token de curta duração** (JWT assinado) com
  `tenant_id` e `scopes`.
- **OAuth2 Authorization Code + PKCE** quando a aplicação externa age **em nome de
  um usuário** do tenant (ex.: app de terceiro que um veterinário autoriza a ver
  sua agenda). Consentimento explícito + escopos solicitados.
- **API keys** por tenant como opção simples para casos internos/baixo risco
  (sempre escopadas e revogáveis) — **[A DEFINIR]** se ofereceremos além do OAuth2.
- Credenciais e segredos **apenas no servidor/cofre** (nunca em front/app público).
- Validação **server-side** a cada request; tokens revogáveis; rotação de segredos.

## 4. Autorização: escopos + tenant + RBAC

- **Escopos granulares** por recurso e ação, ex.:
  `clients:read`, `clients:write`, `appointments:read`, `appointments:write`,
  `medical-records:read`, `inventory:read`, `billing:read`, `webhooks:manage`.
- Toda chamada externa é **escopada a um tenant** e filtrada por **RLS** no banco
  (doc 03) — uma aplicação de um tenant nunca acessa dados de outro.
- **Menor privilégio**: a aplicação recebe só os escopos que o tenant concedeu.
- Escopos respeitam o RBAC (doc 07): um token não pode exceder o que o papel
  associado permite.

## 5. Contrato, versionamento e DX

- **OpenAPI 3.1** como fonte de verdade → SDKs/clientes gerados; docs sempre
  sincronizadas.
- **Versionamento** por major em path (`/api/v1`); mudanças quebra-compatibilidade
  só em nova major. **Política de depreciação** publicada (janela mínima + header
  `Deprecation`/`Sunset`).
- **Portal do desenvolvedor** (fase de exposição externa): registro de aplicações,
  gestão de credenciais/escopos, documentação interativa, changelog.
- **Ambiente de sandbox** por tenant para parceiros testarem sem afetar produção.
- Padrões REST: paginação por cursor, filtros consistentes, erros padronizados
  (RFC 7807 `application/problem+json`), **idempotency-key** em escritas.

## 6. Webhooks de saída (eventos para fora)

Complementa as integrações de entrada do doc 06: o VETAPP **notifica** aplicações
externas quando algo acontece.

- Parceiros assinam **eventos de domínio** já existentes (doc 04 §3): ex.
  `appointment.created`, `medical_record.updated`, `inpatient.medication_executed`,
  `inpatient.discharge`, `invoice.created`.
- Entrega assinada com **HMAC** (segredo por assinatura) para o consumidor
  verificar autenticidade; **retries** com back-off e **dead-letter**; histórico
  de entregas consultável.
- Gestão via escopo `webhooks:manage`; entrega feita pelos **workers** (doc 01),
  desacoplada do request.

## 7. Segurança específica de API exposta (doc 02 reforçado)

- **Rate limiting + quotas por aplicação** (e por tenant), com burst control.
- **WAF + Cloudflare** na frente; o **Gateway/BFF** segue como única superfície
  pública.
- **Auditoria** de todo acesso de API (qual app, qual tenant, qual escopo, quando)
  na trilha imutável (doc 02 §6).
- Detecção de abuso (picos anômalos, varredura), bloqueio/rotação de credencial.
- Sem acesso direto a banco/storage: dados sempre pela API; anexos só por **URL
  assinada** de curta validade (doc 01).
- TLS 1.2+/1.3 obrigatório; CORS restrito por aplicação para clientes browser.

## 8. Impacto no roadmap (ver doc 08)

A API **interna** (consumida por web/mobile) já é Fase 1. A **exposição externa**
controlada entra de forma incremental:

- **Fase 1:** API `/api/v1` + OpenAPI desde o início (já previsto). Desenhar
  escopos e o modelo OAuth2 desde já, mesmo sem portal externo.
- **Fase 2:** **OAuth2 Client Credentials** + API keys, rate limiting/quotas,
  **webhooks de saída** — habilita conectar as "outras aplicações" do dono.
- **Fase 3:** **Portal do desenvolvedor**, sandbox, Authorization Code + PKCE para
  apps de terceiros agindo em nome de usuários, programa de parceiros.

## 9. Pendências **[A DEFINIR]**
- Audiência inicial: **apenas aplicações do próprio dono (M2M)** vs. **parceiros
  externos** — define se priorizamos portal/sandbox já na Fase 2.
- Oferecer **API keys** além de OAuth2, ou só OAuth2.
- Modelo de **quotas/planos** de uso (se a API virar produto comercializável).
- Conjunto inicial de **escopos** e de **eventos de webhook** a publicar.
- Gateway de API dedicado (ex.: Kong/APISIX) vs. rate limiting no próprio
  BFF/NestJS — avaliar quando o volume externo crescer.
