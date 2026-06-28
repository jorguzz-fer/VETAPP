import createClient, { type Client } from 'openapi-fetch';
import type { paths } from './schema';

export type { paths } from './schema';
export type VetappClient = Client<paths>;

export interface CreateApiClientOptions {
  /** Base URL da API, ex.: http://localhost:3333 */
  baseUrl: string;
  /** Retorna o access token atual (Bearer), se houver. */
  getToken?: () => string | null | undefined;
}

/**
 * Cria um cliente tipado da API VETAPP. Os tipos vêm de `schema.d.ts`, gerado do
 * OpenAPI (`pnpm --filter @vetapp/api-client gen`).
 *
 * Observação de segurança (docs/spec/02): em produção a sessão web usa cookie
 * httpOnly via BFF; o `getToken` Bearer é o caminho para clientes não-browser
 * (mobile/integrações) e para o scaffold atual.
 */
export function createApiClient({ baseUrl, getToken }: CreateApiClientOptions): VetappClient {
  const client = createClient<paths>({ baseUrl });

  if (getToken) {
    client.use({
      onRequest({ request }) {
        const token = getToken();
        if (token) request.headers.set('authorization', `Bearer ${token}`);
        return request;
      },
    });
  }

  return client;
}
