# 10 — UX/UI e Design System

> Define a **base visual** do VETAPP e como ela se encaixa na arquitetura
> server-authoritative (docs 01 e 02). Os **princípios de UX** do redesign estão
> no doc 00 §4 — este documento trata da implementação visual.

## 1. Base visual: template Trezo (React/Next + Tailwind)

A UI do front web parte do template comercial **Trezo – Admin Dashboard**
(v3.6.0), na variação **React/Next.js + Tailwind CSS**.

- **Licença:** **Extended License** (ThemeForest) — confirmada. Cobre produto
  **SaaS multitenant com usuários pagantes**, que é o caso do VETAPP.
- **Por que esta variação:** Tailwind permite construir um **design system
  próprio** (tokens de cor/tipografia/espaçamento) e abre caminho para
  **reaproveitamento no app nativo** (React Native via NativeWind) na fase 3 — o
  que uma lib de componentes (ex.: MUI) não oferece. Alinha com a diretriz do doc
  00/01 de "design system próprio baseado na direção visual /v3".

### Stack do template
- **Next.js 15.3 + React 19 + TypeScript 5 + Tailwind 4** (alinhado ao TS
  end-to-end do doc 01).
- Bibliotecas inclusas: **ApexCharts** (gráficos dos dashboards), **FullCalendar**
  (agenda), **Swiper** (carrosséis), **Remixicon / Material Symbols** (ícones),
  react-calendar, react-simple-wysiwyg.

## 2. Como se encaixa na arquitetura

- O template é **apenas a camada de apresentação**. Toda regra de negócio, auth e
  autorização permanecem no servidor (NestJS) — o front **nunca** é fronteira de
  confiança (docs 01 §1, 02 §1).
- O front consome a **API versionada** (`/api/v1`) via cliente gerado do OpenAPI;
  nenhum segredo/token de terceiros no bundle.
- **Build/entrega:** o Trezo vem com `output: 'export'` (export estático/SPA).
  Duas opções:
  - **Manter estático** e servir o SPA atrás da Cloudflare (CDN) — simples e
    aderente ao "front é só apresentação".
  - **Trocar para Next standalone/SSR** caso queiramos recursos de servidor do
    Next (BFF no próprio Next). **[A DEFINIR]** — decidir no início da Fase 1.
    *Recomendação:* começar estático (SPA) + BFF no NestJS, evitando dois BFFs.

## 3. Design system próprio (camada sobre o Trezo)

Não usar o Trezo "as-is": extrair uma camada de design system para garantir
identidade e portabilidade.

1. **Tokens** (cores, tipografia, espaçamento, raios, sombras) num pacote
   compartilhável (`@vetapp/design-tokens`), consumidos pelo Tailwind config.
2. **Componentes base** (botão, input, tabela, card, modal, toast) encapsulando os
   do Trezo, para podermos trocar/evoluir sem reescrever telas.
3. **Tema por tenant** (white-label leve): logo e, opcionalmente, cor primária por
   clínica (ver doc 03 §5).

   > **Logo da clínica implementado** — tabela de domínio `tenant_branding`
   > (migração 0024, uma linha por tenant, **RLS fail-closed** padrão `NULLIF`; o
   > branding **não é público**, então é RLS-scoped, diferente do `site_config`).
   > O logo mora no **R2** (bucket privado): a app guarda só a `logo_key` e serve
   > **URL assinada** curta — nunca proxia bytes (doc 02 §4). API `/api/branding`:
   > `GET` (qualquer membro autenticado, para renderizar) e `POST logo/sign-upload`
   > · `POST logo` · `DELETE logo` (**admin**). UI em `/configuracoes` (card com
   > preview + upload + remover) e o logo aparece no **cabeçalho da sidebar**. As
   > escritas são auditadas (doc 02 §6). **Pendente**: cor primária por tenant;
   > reuso do logo nos documentos impressos/2ª via quando essas views existirem (o
   > `GET /api/branding` já as atende).
4. **Caminho nativo:** tokens reaproveitados no React Native via **NativeWind** na
   fase 3 (doc 01 §2 / doc 08).

## 4. Princípios de UX aplicados ao tema

Reaproveitar os componentes do Trezo **respeitando** os princípios do doc 00 §4:

- **Navegação em contexto** — usar layout com painel/rotas internas; evitar
  empilhar modais (vício do sistema legado).
- **Toda ação tem efeito** — remover botões/ícones decorativos que o template traz
  de exemplo.
- **Consolidar** — um dashboard por domínio (vendas, produtividade) usando os
  blocos ApexCharts, sem multiplicar telas.
- **Simplicidade clínica** — telas densas (prontuário, internação) priorizam fluxo
  e densidade de informação útil, não enfeite.

## 5. Mapa template → módulos VETAPP (referência inicial)

| Recurso do Trezo | Uso no VETAPP |
|------------------|---------------|
| Dashboards + ApexCharts | Home por persona, dashboard de Vendas (4.2) e Produtividade (6.1) |
| FullCalendar | Agenda diária / por login (3.1), Escala (3.2) |
| Tabelas/listas + filtros | Lista de clientes/pacientes (2.1), Tabela de preços (4.7), Histórico de internações (9.3) |
| Formulários/wizard | Cadastro cliente/animal, catálogo único (8.x), modelos (receita/documento/orçamento) |
| Cards de status | Dashboard de internação (9.1), telas TV/tablet por box |
| WYSIWYG | Editor de modelos de receita/documento (8.10/8.12) |
| Kanban/board (se houver) | Mapa de execução da internação (9.2) — avaliar |

## 6. Higienização do pacote

A pasta de origem traz ~33 variações de framework (Vue, Angular, Laravel, etc.).
Para o VETAPP:
- **Manter apenas** a variação `react-nextjs-tailwindcss` como base de referência.
- **Descartar** as demais variações (não versionar no repo).
- Importar para o monorepo só os artefatos efetivamente usados (componentes,
  estilos, assets), sob a camada de design system do §3.

## 7. Pendências **[A DEFINIR]**
- `output: 'export'` (SPA estático) × Next SSR/standalone — decidir no início da
  Fase 1.
- Inventário fino de quais telas/Componentes do Trezo serão reaproveitados vs.
  construídos do zero.
- Política de tema por tenant (apenas logo+cor primária na fase 1?).

## 8. Conformidade de licença
- **Extended License** adquirida — uso em SaaS pago autorizado.
- Manter o comprovante de licença no controle do projeto.
- Atenção a sublicenciamento: não redistribuir o template como template; o produto
  final (VETAPP) é o entregável permitido.
