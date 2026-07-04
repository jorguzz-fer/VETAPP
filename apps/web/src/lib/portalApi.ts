import { createApiClient } from '@vetapp/api-client';

// Tokens do PORTAL DO TUTOR — separados dos tokens da gestão (chaves próprias no
// localStorage). O tutor nunca compartilha sessão com um usuário interno.
const TOKEN_KEY = 'vetapp.portal.accessToken';
const REFRESH_KEY = 'vetapp.portal.refreshToken';
const TENANT_KEY = 'vetapp.portal.tenantId';

export const portalTokenStore = {
  get: (): string | null => (typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null),
  getRefresh: (): string | null =>
    typeof window !== 'undefined' ? window.localStorage.getItem(REFRESH_KEY) : null,
  getTenant: (): string | null =>
    typeof window !== 'undefined' ? window.localStorage.getItem(TENANT_KEY) : null,
  set: (accessToken: string, refreshToken?: string, tenantId?: string): void => {
    window.localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
    if (tenantId) window.localStorage.setItem(TENANT_KEY, tenantId);
  },
  setTenant: (tenantId: string): void => window.localStorage.setItem(TENANT_KEY, tenantId),
  clear: (): void => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    // Mantém o tenantId: ajuda o próximo login na mesma clínica.
  },
};

export const portalApi = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333',
  getToken: () => portalTokenStore.get(),
});

// Instante de expiração (ms) do access JWT, lido do claim `exp`. null se ilegível.
export function portalTokenExpiry(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function formatCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
