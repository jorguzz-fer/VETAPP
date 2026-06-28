/**
 * Tokens de design do VETAPP — primitivos extraídos da base visual Trezo.
 *
 * Fonte de verdade para a WEB: `apps/web/src/app/globals.css` (Tailwind 4 @theme).
 * Este módulo espelha os primitivos em TS para uso fora do Tailwind — sobretudo o
 * futuro app **React Native** (NativeWind) e qualquer geração programática de tema.
 * Mantenha os dois em sincronia (ver docs/spec/10 §3).
 */

export const colors = {
  white: '#ffffff',
  black: '#3a4252',
  dark: '#000000',
  primary: {
    50: '#ecf0ff',
    100: '#dde4ff',
    200: '#c2cdff',
    300: '#9caaff',
    400: '#757dff',
    500: '#605dff', // cor primária
    600: '#4936f5',
    700: '#3e2ad8',
    800: '#3225ae',
    900: '#2d2689',
  },
  secondary: {
    50: '#eef6ff',
    100: '#daebff',
    200: '#bddcff',
    300: '#90c7ff',
    400: '#5da8ff',
    500: '#3584fc',
    600: '#1f64f1',
    700: '#174ede',
    800: '#1940b4',
    900: '#1a3a8e',
  },
} as const;

export const typography = {
  fontBody: '"Inter", sans-serif',
  sizes: {
    xs: 12,
    sm: 13,
    base: 14,
    md: 16,
    lg: 18,
    xl: 24,
    '2xl': 28,
    '3xl': 32,
    '4xl': 36,
    '5xl': 40,
  },
} as const;

export const layout = {
  sidebarWidth: 260,
  // largura do sidebar + respiro usada pelo header/main-content (ver globals.css)
  contentOffset: 285,
} as const;

export const tokens = { colors, typography, layout } as const;
export type Tokens = typeof tokens;
