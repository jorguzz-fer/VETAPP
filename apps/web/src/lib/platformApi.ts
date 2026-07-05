import { createApiClient } from '@vetapp/api-client';

// Tokens do SUPER-ADMIN da plataforma — totalmente separados da gestão e do tutor
// (chaves próprias no localStorage). Escopo 'platform' (doc 15 §2).
const TOKEN_KEY = 'vetapp.platform.accessToken';
const REFRESH_KEY = 'vetapp.platform.refreshToken';

export const platformTokenStore = {
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

export const platformApi = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333',
  getToken: () => platformTokenStore.get(),
});

export function platformTokenExpiry(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function brl(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
