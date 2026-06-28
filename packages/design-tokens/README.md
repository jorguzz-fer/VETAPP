# @vetapp/design-tokens

Primitivos de design do VETAPP (cores, tipografia, layout) extraídos da base visual
**Trezo**.

- **Web**: a fonte de verdade é `apps/web/src/app/globals.css` (Tailwind 4 `@theme`).
- **Aqui**: espelho em TypeScript dos primitivos, para uso fora do Tailwind — em
  especial o futuro app **React Native** (NativeWind) e geração programática de tema.

Mantenha ambos em sincronia. Ver `docs/spec/10-ux-ui-design-system.md` §3.

```ts
import { colors, typography } from '@vetapp/design-tokens';
colors.primary[500]; // #605dff
```
