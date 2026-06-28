# 01 — Arquitetura técnica

> Esta SPEC **recomenda** uma stack e topologia. As escolhas estão justificadas
> contra os requisitos (multitenant, desktop+mobile, futuro nativo, segurança
> server-side). Pontos marcados **[A DEFINIR]** ficam abertos para validação.

## 1. Princípios arquiteturais

1. **Server-authoritative**: toda regra de negócio, autenticação e autorização
   vivem no servidor. O cliente (web/mobile) é apenas apresentação. Nunca confiar
   em validação feita no front.
2. **Uma API, vários clientes**: web, PWA e (futuro) apps nativos consomem a
   **mesma** API versionada. Nenhuma lógica duplicada por plataforma.
3. **Tenant em primeiro lugar**: o `tenant_id` é dimensão obrigatória em todas as
   camadas (auth, dados, cache, logs, métricas).
4. **Superfície mínima exposta**: somente o gateway/BFF é público; banco, filas,
   workers e serviços internos ficam em rede privada, sem porta exposta.
5. **Modular monolith primeiro, serviços depois**: começar com um monólito modular
   bem fatiado por domínio (fronteiras claras), extraindo serviços só quando a
   escala justificar. Evita complexidade prematura sem travar a evolução.

## 2. Stack recomendada

### Backend
- **Linguagem/runtime**: **TypeScript + Node.js**.
- **Framework**: **NestJS** — modularidade por domínio, DI, guards/interceptors
  (ideais para authz e tenant-context transversais), suporte a REST e WebSocket.
- **API**: **REST + OpenAPI** versionada (`/api/v1`). GraphQL **não** recomendado
  na fase 1 (amplia a superfície e dificulta authz granular); reavaliar se um
  cliente nativo exigir.
- **Realtime**: **WebSocket/SSE** para internação (mapa de execução, telas de
  TV/tablet) e atualizações de agenda/fila.

### Banco de dados
- **PostgreSQL** como base transacional, com **Row-Level Security (RLS)** para
  isolamento multitenant defensivo (ver doc 03).
- **ORM: Drizzle** (preferência do time) — schema em TypeScript, migrations
  versionadas (`drizzle-kit`), SQL previsível e tipado. Combina com o TS
  end-to-end e dá controle fino sobre as queries (importante para performance do
  prontuário/agenda). **Atenção ao multitenancy:** o RLS é aplicado no Postgres;
  o Drizzle define a `tenant_id` em cada query e abre a conexão já com o
  `SET app.tenant_id` (via transação), de modo que app **e** banco reforçam o
  isolamento (ver doc 03).
- **Redis** para cache, sessões/refresh tokens e filas leves.
- **Object storage: Cloudflare R2** (S3-compatível) para anexos do prontuário
  (fotos, exames, vídeos, documentos). R2 é gerenciado pela Cloudflare (fora da
  VPS), **sem custo de egress** e durável por padrão — encaixa com a Cloudflare já
  usada como CDN/WAF na frente. Acesso **sempre** via **URLs assinadas de curta
  duração** emitidas pelo servidor após checagem de permissão; bucket privado, sem
  acesso público direto. Credenciais R2 (tokens S3 API) ficam no cofre, nunca no
  cliente.

### Frontend web (desktop + mobile)
- **React + TypeScript**, **mobile-first** e **responsivo**.
- **Base visual: template Trezo** (React/Next.js + Tailwind, **Extended License**)
  como ponto de partida da UI, com **design system próprio** por cima (tokens
  reaproveitáveis no futuro app React Native via NativeWind). Detalhes no
  **doc 10**.
- **PWA** instalável (offline básico para leitura de prontuário e fila).
- Mantém a direção visual moderna (estilo telas `/v3`), unificando o legado
  `.php`.

### Mobile nativo (fase futura — já contemplado na stack)
- **React Native (Expo)** reaproveitando tipos, contratos de API (cliente gerado
  do OpenAPI) e regras de UI compartilháveis com a web.
- Como toda a lógica de negócio está no servidor, o app nativo é "só" um novo
  cliente da mesma API → **esforço incremental, não um segundo produto**.
- Decisão React Native × nativo puro (Swift/Kotlin) fica **[A DEFINIR]** para a
  fase 3; a arquitetura suporta ambos sem retrabalho de backend.

### Justificativa do TypeScript end-to-end
Um só ecossistema de tipos para backend, web e mobile reduz duplicação, facilita
contratação e permite **compartilhar contratos** (schemas Zod/OpenAPI) entre
camadas. Alternativas consideradas: **Go** (excelente para o backend, melhor
isolamento de runtime, porém perde o reuso de tipos com o front) e **Elixir**
(forte em realtime para internação, mas ecossistema/contratação menores). Para o
estágio do produto, TS end-to-end maximiza velocidade sem comprometer os
requisitos. **[A DEFINIR]** caso a equipe tenha forte preferência por Go no core.

## 2.1 Infraestrutura de deploy — VPS Hostinger

O ambiente alvo é **VPS Hostinger** (não cloud gerenciada). Isso troca serviços
gerenciados por componentes auto-hospedados, mas **mantém todos os princípios de
segurança** (única superfície pública, resto privado).

- **Orquestração**: **Docker Compose** (caminho simples para 1–N VPS). Kubernetes
  só se/quando a escala justificar — evitar complexidade prematura.
- **Reverse proxy / TLS**: **Caddy** ou **Traefik** como único ingress público
  (443), com TLS automático (Let's Encrypt) e, opcionalmente, WAF (Coraza/ModSec)
  e Cloudflare na frente para CDN + mitigação de DDoS.
- **Rede privada**: serviços internos (Postgres, Redis, workers) em rede Docker
  interna, **sem publicar portas** no host. Só o proxy expõe 443. (O object
  storage é o **Cloudflare R2**, externo — acessado pelos workers/API via HTTPS
  com credenciais no cofre.)
- **Firewall do host (UFW/nftables)**: liberar apenas 443 (e 22 restrito por
  IP/chave). Banco/Redis **nunca** acessíveis de fora.
- **Backups**: dumps automatizados do Postgres enviados cifrados para storage
  externo; anexos já residem no **R2** (durável/replicado pela Cloudflare), com
  **versionamento** de bucket habilitado (ver doc 09 — DR).
- **Observabilidade leve**: logs estruturados + Prometheus/Grafana (ou Uptime
  Kuma para começar), acessíveis só por rede interna/VPN.
- **Escala**: começar em 1 VPS robusta (tudo em Compose). Crescer separando
  Postgres em VPS dedicada e replicando a API atrás do proxy. A arquitetura
  modular permite essa evolução sem reescrever.

> **Nota LGPD/região**: confirmar com a Hostinger a **região de hospedagem**
> (preferência Brasil/São Paulo) — ver doc 02 e 09. **[A DEFINIR]**

## 3. Topologia (alto nível)

```
                          Internet (somente HTTPS)
                                   │
                          ┌────────▼─────────┐        ┌──────────────────┐
                          │ Cloudflare       │        │  Cloudflare R2    │
                          │ WAF + CDN/TLS    │        │  (object storage) │
                          └────────┬─────────┘        │  bucket privado,  │
                                   │                  │  URLs assinadas   │
                          ┌────────▼─────────┐        └─────────▲────────┘
                          │  API Gateway /   │  ← ÚNICA          │ HTTPS + creds
                          │      BFF         │    superfície     │ (cofre)
                          └────────┬─────────┘    pública        │
                                   │  (rede privada, sem rotas expostas)
        ┌──────────────┬──────────┼───────────┬──────────────────┘
        │              │          │           │
   ┌────▼───┐    ┌─────▼────┐ ┌───▼────┐ ┌────▼─────┐
   │ Core   │    │ Realtime │ │Workers │ │Integr.   │
   │ API    │    │ (WS/SSE) │ │(filas) │ │(Google/  │
   │(NestJS)│    │          │ │        │ │ WhatsApp/│
   └────┬───┘    └─────┬────┘ └───┬────┘ │ Petlove) │
        │              │          │      └────┬─────┘
        └──────────────┴────┬─────┴───────────┘
                       ┌────▼─────┐   ┌─────────┐
                       │PostgreSQL│   │  Redis  │
                       │  (RLS)   │   │         │
                       └──────────┘   └─────────┘
```

**Regras da topologia**
- Apenas o **Gateway/BFF** tem IP/porta pública. Os demais serviços da VPS vivem
  em rede privada, sem rota de entrada da internet.
- O **object storage (R2)** é externo (Cloudflare): acessado apenas pelos
  workers/API via HTTPS com credenciais no cofre; o cliente só recebe **URLs
  assinadas** de curta validade, nunca a credencial.
- Comunicação interna por **mTLS** ou malha de serviço; segredos em cofre
  (Vault/KMS), nunca no código ou no cliente.
- Banco e Redis **não** aceitam conexão externa.
- Webhooks de terceiros (WhatsApp/Google) entram por endpoint dedicado e
  **assinado/verificado**, isolado do resto.

## 4. Padrão BFF (Backend for Frontend)

O cliente fala apenas com o BFF. O BFF:
- mantém a sessão em **cookie httpOnly + Secure + SameSite** (web) — tokens nunca
  acessíveis a JavaScript;
- injeta o **tenant context** e o **escopo de permissões** em cada chamada;
- agrega chamadas para reduzir round-trips em telas densas (prontuário, agenda);
- é o único componente que conhece tokens de terceiros (Google/WhatsApp) — o
  front nunca os vê.

Para apps nativos, o mesmo backend expõe fluxo OAuth/OIDC com tokens de curta
duração + refresh rotativo guardados no keystore seguro do dispositivo (ver doc
02).

## 5. Versionamento e contratos

- API versionada (`/api/v1`); mudanças quebra-compatibilidade só em nova major.
- **OpenAPI** como fonte de verdade; clientes (web/mobile) geram tipos a partir
  dele → contrato único, menos drift.
- Eventos de domínio (ex.: `medicacao.executada`, `internacao.alta`) publicados
  em fila para acionar **faturamento automático**, lembretes e integrações de
  forma desacoplada.

## 6. Decisões em aberto **[A DEFINIR]**
- React Native × nativo puro para a fase 3.
- Go no core vs. TS end-to-end.
- Cloud provider e região (impacta LGPD — preferência por região no Brasil).
- Banco single-DB multi-schema vs. single-DB shared-schema com RLS (ver doc 03).
