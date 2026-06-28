# @vetapp/web

Front web do VETAPP — **Next.js 15 + React 19 + Tailwind 4**, base visual **Trezo**
(curada) + design system próprio (`@vetapp/design-tokens`).

## Rodar

```bash
pnpm install
pnpm --filter @vetapp/web dev   # ou: pnpm dev:web
```

App em `http://localhost:3000` (porta padrão do Next).

## O que há neste scaffold
- **Tokens do Trezo** em `src/app/globals.css` (Tailwind 4 `@theme`: cores,
  tipografia…), espelhados em `@vetapp/design-tokens` para o futuro app nativo.
- **Shell de navegação** próprio (`providers/LayoutProvider` + `components/layout/`
  Sidebar/Header/Footer) reusando o sistema de layout do Trezo (`main-content-wrap`,
  `sidebar-area`, `header-area`, `main-content`), com **menu por domínio/persona**
  (`src/lib/nav.ts`) — não o menu de demos do template.
- **Componentes base** do design system (`components/ui/` Card, Button).
- **Dashboard** de exemplo (`/dashboard`) com KPIs.

## Curadoria (importante)
Importamos do Trezo **apenas a fundação** (tokens + padrão de layout), não as ~40
verticais de demo (NFT, Hotel, Restaurant…). Componentes de tela específicos serão
trazidos sob demanda conforme construímos cada módulo (ver `docs/spec/10` §6 e o
`NOTICE.md`).

## Próximas iterações
- Telas reais por módulo (clientes, prontuário, agenda, internação…).
- Cliente de API gerado do OpenAPI (consumindo `@vetapp/api`).
- Auth (login/MFA/Google) integrada ao back.
- Tema por tenant (logo + cor primária) e dark mode.
- Decidir `output: 'export'` (SPA) × Next SSR (doc 10 §2).
