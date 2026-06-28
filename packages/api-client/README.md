# @vetapp/api-client

Cliente **tipado** da API VETAPP, gerado a partir do contrato **OpenAPI**
(docs/spec/11 — API-first / OpenAPI como fonte de verdade).

## Regenerar (sempre que a API mudar)
```bash
# 1) emite o spec a partir da API (NestJS + Swagger)
pnpm --filter @vetapp/api openapi:gen      # → packages/api-client/openapi.json
# 2) gera os tipos TypeScript
pnpm --filter @vetapp/api-client gen        # → src/schema.d.ts
```

## Uso
```ts
import { createApiClient } from '@vetapp/api-client';

const api = createApiClient({
  baseUrl: 'http://localhost:3333',
  getToken: () => localStorage.getItem('accessToken'),
});

const { data, error } = await api.POST('/api/auth/login', {
  body: { email, password },
});
```

> Segurança: em produção a sessão web usa **cookie httpOnly via BFF** (docs/spec/02);
> o Bearer/`getToken` atende clientes não-browser e o scaffold atual.
