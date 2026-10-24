/// <reference types="vite/client" />
/** Build-specific boundaries; the website keeps its existing same-origin contract. */
export const IS_TOY = import.meta.env?.MODE === 'toy';
export const API_ORIGIN = IS_TOY ? 'https://vibe.freakz2z.com' : '';
const entry = typeof window === 'undefined' ? '/' : new URL('./index.html', window.location.href).pathname;
export function routeHref(href: string): string {
  return IS_TOY && href.startsWith('/') && !href.startsWith('//') ? `${entry}#${href}` : href;
}
export function assetUrl(value: string): string {
  return IS_TOY && value.startsWith('/media/') ? new URL(`.${value.replace(/\.geojson$/, '.json')}`,  new URL('./', window.location.href)).href : value;
}
export function apiUrl(value: string): string {
  return IS_TOY && value.startsWith('/api/labs/') ? API_ORIGIN + value.replace('/api/labs/', '/api/toy/labs/') : value;
}
