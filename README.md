# VETAPP

Plataforma de gestão para clínicas veterinárias — reescrita conceitual do fluxo
mapeado a partir do SimplesVet, com foco em UX limpa, prontuário eletrônico como
coração do produto e faturamento integrado ao ato clínico.

> **Status:** Especificação (Fase de design). Ainda não há implementação.

## Diretrizes de produto (do dono / stakeholders)

- **Desktop e Mobile** desde o início (web responsiva), com caminho claro para
  **apps nativos iOS e Android** em fases futuras.
- **Multitenant**: uma única plataforma servindo várias clínicas, com isolamento
  rígido de dados por clínica (tenant).
- **Autenticação com MFA e conectores Google** (login social + Google Agenda).
- **Segurança de altíssimo nível**: autenticação e autorização **sempre no
  servidor**; nenhuma porta aberta ou rota de negócio exposta diretamente ao
  cliente; o front nunca é a fronteira de confiança.
- **API-first**: tudo disponível via API versionada, para conectar o VETAPP a
  outras aplicações (acesso externo autenticado e escopado, nunca aberto).
- **Navegar em contexto** em vez de empilhar telas/modais.
- **Consolidar, não multiplicar** relatórios e cadastros.

## Documentação da SPEC

A especificação está em [`docs/spec/`](docs/spec/):

| Doc | Conteúdo |
|-----|----------|
| [00 — Visão geral e princípios](docs/spec/00-visao-geral.md) | Objetivo, personas, princípios de UX, escopo por fase |
| [01 — Arquitetura técnica](docs/spec/01-arquitetura.md) | Stack recomendada, topologia, BFF, mobile/desktop, padrão nativo futuro |
| [02 — Segurança e autenticação](docs/spec/02-seguranca-autenticacao.md) | MFA, Google connectors, server-side auth, modelo de ameaças |
| [03 — Multitenancy](docs/spec/03-multitenancy.md) | Isolamento por tenant, RLS, ciclo de vida do tenant |
| [04 — Modelo de dados](docs/spec/04-modelo-dados.md) | Domínios, entidades principais, catálogo único |
| [05 — Módulos funcionais](docs/spec/05-modulos-funcionais.md) | Mapeamento tela a tela → decisão de redesign |
| [06 — Integrações](docs/spec/06-integracoes.md) | Petlove/Vet Smart, Google Agenda, WhatsApp, IA |
| [07 — Perfis e RBAC](docs/spec/07-perfis-rbac.md) | Papéis, permissões, visão por login |
| [08 — Roadmap por fases](docs/spec/08-roadmap.md) | O que entra em cada fase; cortes da fase 1 |
| [09 — Requisitos não-funcionais](docs/spec/09-requisitos-nao-funcionais.md) | Desempenho, observabilidade, LGPD, DR |
| [10 — UX/UI e Design System](docs/spec/10-ux-ui-design-system.md) | Base visual (Trezo React/Next + Tailwind), design system próprio, mapa template→módulos |
| [11 — API pública e integrações](docs/spec/11-api-publica-integracoes.md) | API-first, acesso M2M (OAuth2 + escopos), webhooks de saída, versionamento/DX |
| [12 — Testes e Code Review](docs/spec/12-testes-code-review.md) | Estratégia de testes, gates de CI, processo de revisão, Definition of Done |
| [13 — Módulos complementares](docs/spec/13-modulos-complementares.md) | Rascunho: Financeiro, Estoque, Fiscal, Site, Portal do tutor (a validar) |

## Blueprint reutilizável

As boas práticas aplicadas neste projeto (stack, arquitetura, deploy, segurança,
multitenancy, UX/UI, API-first + qualidade/processo) estão consolidadas num
documento **genérico** para iniciar outros projetos:
[`docs/blueprint/engineering-blueprint.md`](docs/blueprint/engineering-blueprint.md).

## Fonte

Esta SPEC deriva do documento *"Mapeamento de Telas e Funcionalidades — SimplesVet
(base para Spec do redesign)"* (mapeamento de 25/06/2026), preservado em
[`docs/spec/fonte-mapeamento.md`](docs/spec/fonte-mapeamento.md).
