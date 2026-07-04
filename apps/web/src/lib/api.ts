import { createApiClient } from '@vetapp/api-client';

const TOKEN_KEY = 'vetapp.accessToken';
const REFRESH_KEY = 'vetapp.refreshToken';

// Guarda access + refresh token. O refresh é stateful no servidor (rotação +
// detecção de reuso — doc 02 §2.2); aqui só o transportamos. Produção futura
// migra para cookie httpOnly/BFF (doc 02).
export const tokenStore = {
  get: (): string | null => (typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null),
  getRefresh: (): string | null =>
    typeof window !== 'undefined' ? window.localStorage.getItem(REFRESH_KEY) : null,
  set: (accessToken: string, refreshToken?: string): void => {
    window.localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: (): void => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

// Cliente tipado da API. baseUrl vem de NEXT_PUBLIC_API_URL (default: dev local).
// Scaffold usa Bearer via localStorage; produção usará cookie httpOnly/BFF (doc 02).
export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333',
  getToken: () => tokenStore.get(),
});

// Instante de expiração (ms) do access JWT, lido do claim `exp`. null se ilegível.
export function accessTokenExpiry(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}
