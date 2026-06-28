import { createApiClient } from '@vetapp/api-client';

const TOKEN_KEY = 'vetapp.accessToken';

export const tokenStore = {
  get: (): string | null => (typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null),
  set: (t: string): void => window.localStorage.setItem(TOKEN_KEY, t),
  clear: (): void => window.localStorage.removeItem(TOKEN_KEY),
};

// Cliente tipado da API. baseUrl vem de NEXT_PUBLIC_API_URL (default: dev local).
// Scaffold usa Bearer via localStorage; produção usará cookie httpOnly/BFF (doc 02).
export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333',
  getToken: () => tokenStore.get(),
});
