import type { Catalog } from '../shared/contracts';

/** JSON script elements are data, but HTML parsers still recognize closing script sequences. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function bootstrapScript(catalog: Catalog): string {
  return `<script id="vibe-catalog" type="application/json">${safeJson(catalog)}</script>`;
}

// Runs before stylesheet/body paint; main.tsx applies the same preference when the app starts.
export const initialThemeScript = `<script>try{var m=localStorage.getItem('vibe-theme');var t=m==='dark'?'dark':m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}</script>`;
