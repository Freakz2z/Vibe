import type { ComponentType } from 'react';
import type { DemoCopyHandler } from './types';

/**
 * Every published demo maps to exactly one primary tool (demo.stack), and loads
 * only its own module. Nothing is preloaded, so a GSAP demo never pulls PixiJS.
 */
export type DemoModule = { default: ComponentType<{ onCopy: DemoCopyHandler }> };

const loaders: Record<string, () => Promise<DemoModule>> = {
  // ---- 动画图形 ----
  gsap: () => import('./labs/gsap'),
  motion: () => import('./labs/motion'),
  'react-spring': () => import('./labs/react-spring'),
  threejs: () => import('./labs/threejs'),
  pixijs: () => import('./labs/pixijs'),
  matterjs: () => import('./labs/matterjs'),
  paperjs: () => import('./labs/paperjs'),
  animejs: () => import('./labs/animejs'),
  'lottie-web': () => import('./labs/lottie-web'),
  swiper: () => import('./labs/swiper'),
  'embla-carousel': () => import('./labs/embla-carousel'),
  'dnd-kit': () => import('./labs/dnd-kit'),
  'auto-animate': () => import('./labs/auto-animate'),
  moveable: () => import('./labs/moveable'),

  // ---- 图表与图 ----
  echarts: () => import('./labs/echarts'),
  d3: () => import('./labs/d3'),
  chartjs: () => import('./labs/chartjs'),
  recharts: () => import('./labs/recharts'),
  'observable-plot': () => import('./labs/observable-plot'),
  uplot: () => import('./labs/uplot'),
  g6: () => import('./labs/g6'),
  x6: () => import('./labs/x6'),
  mermaid: () => import('./labs/mermaid'),
  'react-flow': () => import('./labs/react-flow'),
  leaflet: () => import('./labs/leaflet'),
  'maplibre-gl': () => import('./labs/maplibre-gl'),

  // ---- 状态与表单 ----
  zod: () => import('./labs/zod'),
  'tanstack-query': () => import('./labs/tanstack-query'),
  swr: () => import('./labs/swr'),
  zustand: () => import('./labs/zustand'),
  'redux-toolkit': () => import('./labs/redux-toolkit'),
  jotai: () => import('./labs/jotai'),
  htmx: () => import('./labs/htmx'),
  'radix-ui': () => import('./labs/radix-ui'),
  'ant-design': () => import('./labs/ant-design'),
  mantine: () => import('./labs/mantine'),

  // ---- 编辑与内容 ----
  tiptap: () => import('./labs/tiptap'),
  lexical: () => import('./labs/lexical'),
  prosemirror: () => import('./labs/prosemirror'),
  quill: () => import('./labs/quill'),
  codemirror: () => import('./labs/codemirror'),
  'markdown-it': () => import('./labs/markdown-it'),
  shiki: () => import('./labs/shiki'),
  katex: () => import('./labs/katex'),
  remark: () => import('./labs/remark'),

  // ---- 实用工具 ----
  culori: () => import('./labs/culori'),
  colorjs: () => import('./labs/colorjs'),
  prettier: () => import('./labs/prettier'),
  typescript: () => import('./labs/typescript'),
  esbuild: () => import('./labs/esbuild'),

  // ---- 本站真实服务 ----
  d1: () => import('./labs/d1'),
  drizzle: () => import('./labs/drizzle'),
  kysely: () => import('./labs/kysely'),
  hono: () => import('./labs/hono'),
  r2: () => import('./labs/r2'),
};

export function loadDemo(stack: string): Promise<DemoModule> {
  const loader = loaders[stack];
  if (!loader) return Promise.reject(new Error(`没有为 ${stack} 注册示例模块。`));
  return loader();
}

export function hasDemo(stack: string): boolean {
  return stack in loaders;
}

export const DEMO_STACKS = Object.keys(loaders);
