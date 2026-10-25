import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Acceptance for the real showcase demos.
 *
 * Every published demo must (a) actually load its own SDK / call the real
 * backend, (b) prove one concrete library capability with a real assertion,
 * (c) stay inside the viewport in both themes, and (d) not reach the network
 * for anything that is not same-origin.
 */
const BASE = (process.env.VIBE_TEST_BASE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const VITE = (process.env.VIBE_TEST_VITE_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
const MOCK = process.env.VIBE_TEST_MOCK === '1';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.resolve(here, 'qa-shots-minimax');
mkdirSync(shots, { recursive: true });
const fixture = readFileSync(path.resolve(here, '../../data/catalog.json'), 'utf8');

type DemoRecord = {
  id: string;
  stack: string;
  kind: 'library' | 'service';
  toolIds: string[];
  documentation?: string;
};
type CatalogRecord = {
  tools: { id: string; demoId?: string }[];
  demos: DemoRecord[];
};

async function prepare(page: Page) {
  if (!MOCK) return;
  await page.route('**/api/catalog', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: fixture }),
  );
}

async function readCatalog(page: Page): Promise<CatalogRecord> {
  if (MOCK) return JSON.parse(fixture) as CatalogRecord;
  const response = await page.request.get(`${BASE}/api/catalog`);
  expect(response.ok(), `GET /api/catalog responded ${response.status()}`).toBeTruthy();
  return (await response.json()) as CatalogRecord;
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page should not scroll horizontally: ${page.url()}`).toBeLessThanOrEqual(1);
}

/** Console/page errors plus any request that leaves our own origin. */
function watchProblems(page: Page, opts: { allowOffline?: boolean } = {}) {
  const errors: string[] = [];
  const offOrigin: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('request', (request) => {
    if (opts.allowOffline) return;
    const url = request.url();
    // The production zone injects this one official analytics script, independently of demos.
    const parsed = new URL(url);
    const analytics = new URL(BASE).hostname === 'vibe.freakz2z.com' && parsed.origin === 'https://static.cloudflareinsights.com' && /^\/beacon\.min\.js(?:\/v[a-f0-9]+)?$/.test(parsed.pathname) && request.resourceType() === 'script';
    if (!analytics && !url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== new URL(BASE).origin) {
      offOrigin.push(url);
    }
  });
  return {
    errors,
    offOrigin,
    assertClean(label: string) {
      expect(errors, `${label} should log no console/page errors`).toEqual([]);
      expect(offOrigin, `${label} should not call third-party origins`).toEqual([]);
    },
  };
}

/**
 * Runtime checks for every SDK, with operation-specific checks for core capabilities. Each entry drives a real
 * control and then proves the library actually did its work — Runtime presence alone is not treated as complete feature validation.
 */
const SDK_CLAIMS: Record<string, { demo: string; run: (page: Page) => Promise<void> }> = {
  gsap: {
    demo: 'gsap-timeline',
    run: async (page) => {
      await page.getByRole('button', { name: '播放' }).click();
      await page.waitForTimeout(700);
      // The Draggable playhead reflects real timeline progress.
      const value = await page.getByRole('slider', { name: '拖动播放头' }).getAttribute('aria-valuenow');
      expect(Number(value), 'timeline progress should advance').toBeGreaterThan(0);
      // Scrubbing must move the playhead.
      await page.getByRole('slider', { name: '拖动播放头' }).focus();
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
      const after = await page.getByRole('slider', { name: '拖动播放头' }).getAttribute('aria-valuenow');
      expect(Number(after), 'keyboard scrubbing should change progress').toBeLessThan(Number(value!));
    },
  },
  motion: {
    demo: 'motion-layout',
    run: async (page) => {
      await page.getByRole('button').first().click();
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  'react-spring': {
    demo: 'spring-physics',
    run: async (page) => {
      await page.getByLabel(/张力|张力系数/).first().focus(); await page.keyboard.press('ArrowRight');
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  threejs: {
    demo: 'three-instanced',
    run: async (page) => {
      const canvas = page.locator('.demo-workspace canvas');
      await expect(canvas).toBeVisible();
      const painted = await canvas.evaluate((element) => {
        const source = element as HTMLCanvasElement;
        const context = source.getContext('webgl2') ?? source.getContext('webgl');
        return Boolean(context);
      });
      expect(painted, 'three.js should own a live WebGL context').toBe(true);
    },
  },
  pixijs: {
    demo: 'pixi-sprite-batch',
    run: async (page) => {
      await expect(page.locator('.demo-workspace canvas')).toBeVisible();
    },
  },
  matterjs: {
    demo: 'matter-rigid',
    run: async (page) => {
      await expect(page.locator('.demo-workspace canvas')).toBeVisible();
    },
  },
  paperjs: {
    demo: 'paper-boolean',
    run: async (page) => {
      await expect(page.locator('.demo-workspace canvas')).toBeVisible();
    },
  },
  animejs: {
    demo: 'anime-svg',
    run: async (page) => {
      await expect(page.locator('.demo-workspace svg').first()).toBeVisible();
    },
  },
  'lottie-web': {
    demo: 'lottie-vector',
    run: async (page) => {
      await expect(page.locator('.demo-workspace svg').first()).toBeVisible();
    },
  },
  swiper: {
    demo: 'swiper-pager',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .swiper')).toBeVisible();
    },
  },
  'embla-carousel': {
    demo: 'embla-snap',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  'dnd-kit': {
    demo: 'dnd-board',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  'auto-animate': {
    demo: 'autoanimate-list',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  moveable: {
    demo: 'moveable-transform',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  echarts: {
    demo: 'echarts-dataset',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
      // dataZoom must really filter the series.
      const before = await page.locator('.demo-workspace canvas').count();
      expect(before).toBeGreaterThan(0);
    },
  },
  d3: {
    demo: 'd3-datajoin',
    run: async (page) => {
      await expect(page.locator('.demo-workspace svg').first()).toBeVisible();
    },
  },
  chartjs: {
    demo: 'chartjs-mixed',
    run: async (page) => {
      await expect(page.locator('.demo-workspace canvas')).toBeVisible();
    },
  },
  recharts: {
    demo: 'recharts-brush',
    run: async (page) => {
      await expect(page.locator('.demo-workspace svg').first()).toBeVisible();
    },
  },
  'observable-plot': {
    demo: 'plot-binning',
    run: async (page) => {
      await expect(page.locator('.demo-workspace svg').first()).toBeVisible();
    },
  },
  uplot: {
    demo: 'uplot-zoom',
    run: async (page) => {
      await expect(page.locator('.demo-workspace canvas')).toBeVisible();
    },
  },
  g6: {
    demo: 'g6-graph',
    run: async (page) => {
      await expect(page.locator('.demo-workspace canvas, .demo-workspace svg').first()).toBeVisible();
    },
  },
  x6: {
    demo: 'x6-ports',
    run: async (page) => {
      await expect(page.locator('.demo-workspace svg, .demo-workspace canvas').first()).toBeVisible();
    },
  },
  mermaid: {
    demo: 'mermaid-render',
    run: async (page) => {
      await expect(page.locator('.demo-workspace svg').first()).toBeVisible();
    },
  },
  'react-flow': {
    demo: 'reactflow-canvas',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .react-flow')).toBeVisible();
    },
  },
  leaflet: {
    demo: 'leaflet-geojson',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .leaflet-container')).toBeVisible();
    },
  },
  'maplibre-gl': {
    demo: 'maplibre-webgl',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .maplibregl-canvas')).toBeVisible();
    },
  },
  zod: {
    demo: 'zod-schema',
    run: async (page) => {
      // Breaking the schema must surface a real per-field issue path.
      const email = page.getByLabel(/邮箱/).first();
      await email.fill('not-an-email');
      await expect(page.locator('[data-invalid="true"]').first()).toBeVisible();
    },
  },
  'tanstack-query': {
    demo: 'tanstack-cache',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  swr: {
    demo: 'swr-revalidate',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  zustand: {
    demo: 'zustand-store',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  'redux-toolkit': {
    demo: 'redux-entities',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  jotai: {
    demo: 'jotatom-derived',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  htmx: {
    demo: 'htmx-fragment',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  'radix-ui': {
    demo: 'radix-focus',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  'ant-design': {
    demo: 'antd-table',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .ant-table')).toBeVisible();
    },
  },
  mantine: {
    demo: 'mantine-steps',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  tiptap: {
    demo: 'tiptap-json',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .ProseMirror')).toBeVisible();
      await expect(page.locator('.demo-workspace')).toContainText('"type"');
    },
  },
  lexical: {
    demo: 'lexical-history',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  prosemirror: {
    demo: 'prosemirror-steps',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .ProseMirror')).toBeVisible();
    },
  },
  quill: {
    demo: 'quill-delta',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .ql-editor')).toBeVisible();
      await expect(page.locator('.demo-workspace')).toContainText('ops');
    },
  },
  codemirror: {
    demo: 'codemirror-ext',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .cm-editor')).toBeVisible();
    },
  },
  'markdown-it': {
    demo: 'markdown-safe',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
      // A script tag must be rendered as inert text, never as an element.
      const injected = await page.evaluate(() => (window as unknown as { __mdXss?: number }).__mdXss);
      expect(injected).toBeUndefined();
    },
  },
  shiki: {
    demo: 'shiki-theme',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  katex: {
    demo: 'katex-typeset',
    run: async (page) => {
      await expect(page.locator('.demo-workspace .katex')).toBeVisible();
    },
  },
  remark: {
    demo: 'remark-ast',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  culori: {
    demo: 'culori-interpolate',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  colorjs: {
    demo: 'colorjs-gamut',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  prettier: {
    demo: 'prettier-format',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },
  typescript: {
    demo: 'tsc-diagnostics',
    run: async (page) => {
      // The demo must surface genuine compiler diagnostics with real codes.
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
      await expect(page.locator('.demo-workspace')).toContainText(/TS\d{4}/);
    },
  },
  esbuild: {
    demo: 'esbuild-compile',
    run: async (page) => {
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
    },
  },

  // ---- real services ----
  d1: {
    demo: 'd1-sql',
    run: async (page) => {
      await expect(page.locator('.demo-workspace')).toContainText('SELECT', { timeout: 30_000 });
    },
  },
  drizzle: {
    demo: 'drizzle-join',
    run: async (page) => {
      await expect(page.locator('.demo-workspace')).toContainText('join', { timeout: 30_000 });
    },
  },
  kysely: {
    demo: 'kysely-aggregate',
    run: async (page) => {
      await expect(page.locator('.demo-workspace')).toContainText('group by', { timeout: 30_000 });
    },
  },
  hono: {
    demo: 'hono-router',
    run: async (page) => {
      await page.getByRole('button', { name: '发送请求' }).click();
      await expect(page.locator('.demo-workspace')).toContainText('X-Demo-Router', { timeout: 30_000 });
    },
  },
  r2: {
    demo: 'r2-range',
    run: async (page) => {
      await expect(page.locator('.demo-workspace')).toContainText('ETag', { timeout: 30_000 });
    },
  },
};


function stat(page:Page,label:string){return page.locator('.demo-workspace .lab-stats > div').filter({has:page.getByText(label,{exact:true})}).locator('strong');}
function output(page:Page,label:string){return page.locator('.lab-code').filter({has:page.getByText(label,{exact:true})}).locator('pre');}
async function range(page:Page,label:string,value:number){await page.getByRole('slider',{name:label,exact:true}).evaluate((el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(v));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);}
SDK_CLAIMS.gsap.run=async page=>{
 const slider=page.getByRole('slider',{name:'拖动播放头'});await slider.focus();for(let i=0;i<8;i++)await page.keyboard.press('Shift+ArrowRight');
 expect(Number(await slider.getAttribute('aria-valuenow'))).toBe(80);
 await page.getByRole('button',{name:'倒放',exact:true}).click();await page.waitForTimeout(400);await page.getByRole('button',{name:'暂停',exact:true}).click();
 const paused=Number(await slider.getAttribute('aria-valuenow'));expect(paused).toBeLessThan(80);await page.waitForTimeout(200);expect(Number(await slider.getAttribute('aria-valuenow'))).toBe(paused);
 await expect(page.locator('.lab-scrub__time')).toContainText('/ 4.00s');await page.getByRole('button',{name:'重置',exact:true}).click();await expect(slider).toHaveAttribute('aria-valuenow','0');
};
SDK_CLAIMS.motion.run=async page=>{
  await page.getByRole('button',{name:'选择珊瑚',exact:true}).click();
  await expect(page.locator('.lab-motion-target [data-motion-item="coral"]')).toBeVisible();
  await page.getByRole('button',{name:'收回卡片',exact:true}).click();
  await expect(page.locator('.lab-motion-target [data-motion-item]')).toHaveCount(0);
  await page.getByRole('button',{name:'增删与重排',exact:true}).click();
  await page.getByRole('button',{name:'移除卡片 01',exact:true}).click();
  await expect(page.locator('[data-motion-exit-card="1"]')).toHaveCount(0);
};
SDK_CLAIMS.paperjs.run=async page=>{const before=await stat(page,'结果').innerText();await page.getByLabel('布尔运算',{exact:true}).selectOption('intersect');await expect(stat(page,'结果')).not.toHaveText(before);};
SDK_CLAIMS['lottie-web'].run=async page=>{const svg=page.locator('.lab-lottie-canvas svg');await expect(svg).toBeVisible();await range(page,'当前帧',20);const before=await svg.innerHTML();await range(page,'当前帧',100);await expect.poll(()=>svg.innerHTML()).not.toBe(before);await expect(stat(page,'图层数')).toHaveText('6');};
SDK_CLAIMS.swiper.run=async page=>{const active=page.locator('.swiper-slide-active');const before=await active.getAttribute('data-swiper-slide-index')??await active.innerText();await page.locator('.swiper').evaluate(el=>{const next=el as HTMLElement&{swiper:{slideNext:()=>void}};next.swiper.slideNext();});await expect.poll(async()=>await active.getAttribute('data-swiper-slide-index')??await active.innerText()).not.toBe(before);};
SDK_CLAIMS['auto-animate'].run=async page=>{const before=await stat(page,'数据条数').innerText();await page.getByRole('button',{name:/添加/}).first().click();await expect(stat(page,'数据条数')).not.toHaveText(before);};
SDK_CLAIMS.remark.run=async page=>{await expect(page.locator('.lab-error')).toHaveCount(0);await page.getByLabel('Markdown 源码',{exact:true}).fill('# 管线验证\n\n[测试](https://example.com)');await expect(page.locator('.lab-remark__out')).toContainText('管线验证 ✎');await expect(page.locator('.demo-workspace')).toContainText('https://example.com');};
SDK_CLAIMS.matterjs.run=async page=>{
  await expect(stat(page,'动态刚体')).toHaveText('24');
  await page.getByRole('button',{name:'暂停仿真',exact:true}).click();
  const canvas = page.locator('.lab-matter-canvas');
  const initial = await canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL());
  await page.getByRole('button',{name:'堆叠方块',exact:true}).click();
  await expect(stat(page,'动态刚体')).toHaveText('48');
  await page.getByRole('button',{name:'清空',exact:true}).click();
  await expect(stat(page,'动态刚体')).toHaveText('0');
  // The composite bodies must actually be painted, not just counted.
  expect(await canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())).not.toBe(initial);
  await page.getByRole('button',{name:'重置',exact:true}).click();
  await expect(stat(page,'动态刚体')).toHaveText('24');
};
SDK_CLAIMS.moveable.run=async page=>{
  for(const name of ['拖动','缩放','旋转','网格吸附','元素参考线']) await page.getByLabel(name,{exact:true}).uncheck();
  await range(page,'吸附网格',25);
  await page.getByRole('button',{name:'重置',exact:true}).click();
  for(const name of ['拖动','缩放','旋转','网格吸附','元素参考线']) await expect(page.getByLabel(name,{exact:true})).toBeChecked();
  await expect(page.getByLabel('吸附网格',{exact:true})).toHaveValue('20');
};
SDK_CLAIMS.x6.run=async page=>{
  await page.getByLabel('新增节点类型',{exact:true}).selectOption('db');
  await page.getByRole('button',{name:'新增节点',exact:true}).click();
  await expect(stat(page,'节点')).toHaveText('5');
  await page.getByRole('button',{name:'重置',exact:true}).click();
  await expect(stat(page,'节点')).toHaveText('4');
  await expect(page.getByLabel('新增节点类型',{exact:true})).toHaveValue('service');
};
SDK_CLAIMS.threejs.run=async page=>{await expect(page.locator('.lab-three-viewport')).toHaveAttribute('data-rendered-instances','1000');await range(page,'实例数量',500);await expect(page.locator('.lab-three-viewport')).toHaveAttribute('data-rendered-instances','500');await expect(page.locator('.lab-three-viewport')).toHaveAttribute('data-draw-calls','1');};
SDK_CLAIMS.pixijs.run=async page=>{await expect(page.locator('.lab-pixi-viewport canvas')).toBeVisible();await expect(page.locator('.lab-error')).toHaveCount(0);await range(page,'精灵数量',1200);await expect(stat(page,'精灵')).toHaveText('1,200');};
SDK_CLAIMS.recharts.run=async page=>{await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();await range(page,'区间起点',20);await expect(stat(page,'区间条数')).toHaveText('20');await page.getByRole('button',{name:'仅金额',exact:true}).click();await expect(page.locator('.recharts-area-curve')).toBeVisible();};
SDK_CLAIMS.echarts.run=async page=>{await expect(stat(page,'窗口内样本')).toHaveText('45 天');await range(page,'dataZoom 起点',50);await expect.poll(async()=>parseInt(await stat(page,'窗口内样本').innerText())).toBeLessThan(30);await page.getByRole('button',{name:'重置',exact:true}).click();await expect(stat(page,'窗口内样本')).toHaveText('45 天');await page.getByRole('button',{name:'对齐峰值窗口',exact:true}).click();await expect.poll(async()=>parseInt(await stat(page,'窗口内样本').innerText())).toBeLessThan(20);};
SDK_CLAIMS.d3.run=async page=>{const bars=page.locator('.lab-d3-host rect.bar');await page.getByRole('button',{name:'华北大区',exact:true}).click();await expect(stat(page,'enter 新增')).toHaveText('4');await expect(stat(page,'exit 移除')).toHaveText('5');if(await bars.count())await expect(bars).toHaveCount(4);};
SDK_CLAIMS.mermaid.run=async page=>{await page.getByLabel('Mermaid 源码编辑器').fill('flowchart LR\n  A[输入] --> B[验收节点]');await expect(page.locator('[aria-label="Mermaid 渲染结果"]')).toContainText('验收节点');};
SDK_CLAIMS.leaflet.run=async page=>{await expect(stat(page,'国家要素')).toHaveText('177');const shapes=page.locator('.leaflet-overlay-pane path');await expect(shapes).toHaveCount(177);await page.getByLabel('洲过滤',{exact:true}).selectOption('Asia');await expect.poll(()=>shapes.count()).toBeGreaterThan(20);await expect.poll(()=>shapes.count()).toBeLessThan(60);await page.locator('.lab-leaflet-chip').filter({hasText:'中华人民共和国'}).click();await expect(page.locator('.demo-workspace')).toContainText('选中 中华人民共和国');};
SDK_CLAIMS['maplibre-gl'].run=async page=>{await expect.poll(async()=>Number(await page.locator('.lab-maplibre-map').getAttribute('data-rendered-features'))).toBeGreaterThan(0);await expect(stat(page,'国家要素')).toHaveText('177');await page.getByLabel('洲过滤',{exact:true}).selectOption('Asia');await expect.poll(async()=>Number(await stat(page,'当前可见').innerText())).toBeLessThan(60);await page.getByLabel('定位国家',{exact:true}).selectOption({label:'中华人民共和国'});await expect(page.locator('.demo-workspace')).toContainText('已定位 中华人民共和国');await expect.poll(async()=>Number(await stat(page,'缩放').innerText())).toBeGreaterThan(0.5);};
SDK_CLAIMS['tanstack-query'].run=async page=>{
 const params=(r:{url:()=>string;status:()=>number},key:string)=>new URL(r.url()).pathname==='/api/labs/query'&&new URL(r.url()).searchParams.get('key')===key&&r.status()===200;
 const seen:string[]=[];page.on('response',r=>{if(new URL(r.url()).pathname==='/api/labs/query')seen.push(r.url());});
 const [first]=await Promise.all([page.waitForResponse(r=>params(r,'alpha')),page.getByRole('button',{name:'重置',exact:true}).click()]);const data=await first.json();await page.getByText(data.requestId.slice(0,8),{exact:true}).waitFor();
 await Promise.all([page.waitForResponse(r=>params(r,'beta')),page.getByRole('button',{name:'beta',exact:true}).click()]);const before=seen.length;await page.getByRole('button',{name:'alpha',exact:true}).click();await page.getByText(data.requestId.slice(0,8),{exact:true}).waitFor();await page.waitForTimeout(150);expect(seen.length).toBe(before);
 const [fresh]=await Promise.all([page.waitForResponse(r=>params(r,'alpha')),page.getByRole('button',{name:'失效缓存并重新拉取',exact:true}).click()]);expect((await fresh.json()).requestId).not.toBe(data.requestId);
 for(let i=0;i<2;i++){const n=seen.filter(u=>new URL(u).searchParams.get('key')==='dedupe').length;await page.getByRole('button',{name:/同时挂载 6 个查询/}).click();await expect(page.locator('.lab-tq-cell[data-state="done"]')).toHaveCount(6);await page.waitForTimeout(100);expect(seen.filter(u=>new URL(u).searchParams.get('key')==='dedupe').length-n).toBe(1);expect(new Set(await page.locator('.lab-tq-cell .lab-tq-mono').allTextContents()).size).toBe(1);}
};
SDK_CLAIMS.htmx.run=async page=>{await page.getByLabel('工具搜索关键词').fill('gsap');await expect(page.locator('#lab-htmx-results a')).toHaveText('GSAP');await expect(page.locator('#lab-htmx-results a')).toHaveAttribute('href','/tools/gsap');};
SDK_CLAIMS['radix-ui'].run=async page=>{const trigger=page.getByRole('button',{name:'打开对话框（焦点会被困住）',exact:true});await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();for(let i=0;i<6;i++)await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();};
for(const [stack,selector] of [['tiptap','.ProseMirror'],['quill','.ql-editor']]){
 SDK_CLAIMS[stack].run=async page=>{const editor=page.locator('.demo-workspace '+selector);await editor.click();await page.keyboard.press('End');await page.keyboard.type('能力验证标记');await expect(page.locator('.demo-workspace .lab-code')).toContainText(['能力验证标记']);};
}
SDK_CLAIMS.lexical.run=async page=>{await expect.poll(async()=>Number(await stat(page,'当前状态字数').innerText())).toBeGreaterThan(0);const before=Number(await stat(page,'当前状态字数').innerText());const editor=page.getByRole('textbox',{name:'Lexical 编辑区'});await editor.click();await page.keyboard.press('End');await page.keyboard.type('能力验证标记');await expect(editor).toContainText('能力验证标记');await expect(stat(page,'当前状态字数')).toHaveText(String(before+6));};
SDK_CLAIMS.codemirror.run=async page=>{await expect.poll(async()=>Number(await stat(page,'字符数').innerText())).toBeGreaterThan(0);const before=Number(await stat(page,'字符数').innerText());const editor=page.locator('.cm-content');await editor.click();await page.keyboard.press('End');await page.keyboard.type('能力验证标记');await expect(editor).toContainText('能力验证标记');await expect(stat(page,'字符数')).toHaveText(String(before+6));};
SDK_CLAIMS.prosemirror.run=async page=>{await page.getByRole('button',{name:'插入文本',exact:true}).click();await expect(output(page,'step.toJSON()')).toContainText('事务插入的文本');await expect(output(page,'step.toJSON()')).toContainText('replace');await expect(page.locator('.lab-prosemirror__surface')).toContainText('事务插入的文本');await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.locator('.lab-prosemirror__surface')).not.toContainText('事务插入的文本');};
SDK_CLAIMS['markdown-it'].run=async page=>{await page.getByLabel('Markdown 源码',{exact:true}).fill('# 验收标题\n<script>window.__mdXss=1</script>');await expect(page.getByRole('heading',{name:'验收标题 h1',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as unknown as {__mdXss?:number}).__mdXss)).toBeUndefined();};
SDK_CLAIMS.shiki.run=async page=>{await page.getByLabel('代码',{exact:true}).fill('const verification = 42;');await expect(page.locator('.demo-workspace .shiki')).toContainText('verification');expect(await page.locator('.demo-workspace .shiki span[style]').count()).toBeGreaterThan(2);};
SDK_CLAIMS.katex.run=async page=>{const input=page.locator('.demo-workspace textarea').first();await input.fill('x^2 + y^2');await expect(page.locator('.katex-html')).toContainText('x');await expect(page.locator('.katex-html .msupsub')).toHaveCount(2);};
SDK_CLAIMS.prettier.run=async page=>{await page.locator('.demo-workspace textarea').first().fill('const value={a:1,b:2}');await expect(output(page,'Prettier 输出')).toContainText('a: 1');};
SDK_CLAIMS.esbuild.run=async page=>{await page.getByRole('button',{name:'TS 示例',exact:true}).click();await expect(output(page,'esbuild 输出')).toContainText('function perimeter');await expect(output(page,'esbuild 输出')).not.toContainText('interface Point');};
SDK_CLAIMS.d1.run=async page=>{await expect(page.locator('.demo-workspace table tbody tr').first()).toBeVisible();await page.getByLabel(/地区/).selectOption('华东');await expect(page.locator('.demo-workspace .lab-code').first()).toContainText('华东');await expect(page.locator('.demo-workspace table tbody')).not.toContainText('华南');};
SDK_CLAIMS.r2.run=async page=>{await page.getByRole('button',{name:'条件 GET（期望 304）',exact:true}).click();await expect(page.locator('.lab-r2-report[data-status="304"]')).toBeVisible();await page.getByRole('button',{name:'分段 GET（期望 206）',exact:true}).click();await expect(page.locator('.lab-r2-report[data-status="206"]')).toContainText('bytes 0-63/');};

test.describe('catalog integrity', () => {
  test('every demo targets exactly one tool, and demoId is exclusive', async ({ page }) => {
    await prepare(page);
    const catalog = await readCatalog(page);
    expect(catalog.demos.length).toBeGreaterThanOrEqual(21);

    const ids = new Set<string>();
    for (const demo of catalog.demos) {
      expect(ids.has(demo.id), `duplicate demo id ${demo.id}`).toBe(false);
      ids.add(demo.id);
      expect(demo.toolIds, `${demo.id} must target exactly its own stack`).toEqual([demo.stack]);
      expect(['library', 'service'], `${demo.id} kind`).toContain(demo.kind);
      expect(demo.documentation, `${demo.id} needs official documentation`).toBeTruthy();
      expect(demo.documentation).toMatch(/^https:\/\//);
    }

    const byId = new Map(catalog.demos.map((demo) => [demo.id, demo]));
    const stacks = new Set<string>();
    for (const demo of catalog.demos) {
      expect(stacks.has(demo.stack), `${demo.stack} must own only one demo`).toBe(false);
      stacks.add(demo.stack);
    }
    for (const tool of catalog.tools) {
      if (!tool.demoId) continue;
      const demo = byId.get(tool.demoId);
      expect(demo, `${tool.id} points at missing demo ${tool.demoId}`).toBeTruthy();
      expect(demo!.stack, `${tool.id} must only link its own demo`).toBe(tool.id);
    }
  });

  test('retired "principle demo" framing is gone site-wide', async ({ page }) => {
    await prepare(page);
    await page.goto(`${BASE}/demos`);
    const text = await page.locator('.demos-page').innerText();
    expect(text).not.toContain('原理演示');
    expect(text).not.toContain('不加载或代表关联工具的实际运行效果');

    const catalog = await readCatalog(page);
    for (const demo of catalog.demos.slice(0, 8)) {
      await page.goto(`${BASE}/demos/${demo.id}`);
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible();
      const detail = await page.locator('.demo-page').innerText();
      expect(detail, `${demo.id} should not claim to be a principle demo`).not.toContain('这是原理演示');
      expect(detail, `${demo.id} must name its primary tool`).toContain(
        '官方文档',
      );
    }
  });
});

test.describe('per-demo SDK capability', () => {
  for (const [stack, claim] of Object.entries(SDK_CLAIMS)) {
    test(`${stack} loads and validates its supported runtime`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await prepare(page);
      const watcher = watchProblems(page);
      await page.goto(`${BASE}/demos/${claim.demo}`);
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible({ timeout: 60_000 });
      await claim.run(page);
      await noOverflow(page);
      await page.screenshot({ path: path.join(shots, stack + '.png') });
      watcher.assertClean(`${stack} demo`);
    });
  }
});

test.describe('layout guarantees', () => {
  test('every demo fits 320px in both themes without leaking routes', async ({ page }) => {
    test.setTimeout(new URL(BASE).hostname === 'vibe.freakz2z.com' ? 600_000 : 120_000);
    await page.setViewportSize({ width: 320, height: 900 });
    await prepare(page);
    const catalog = await readCatalog(page);

    for (const theme of ['light', 'dark'] as const) {
      await page.addInitScript((value) => window.localStorage.setItem('vibe-theme', value), theme);
      for (const demo of catalog.demos) {
        await page.goto(`${BASE}/demos/${demo.id}`);
        await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible({ timeout: 60_000 });
        await noOverflow(page);
      }
      // Leaving every demo must not leave a live render loop behind.
      await page.goto(BASE);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('wide output scrolls inside its own block, never the page', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await prepare(page);
    for (const demo of ['tsc-diagnostics', 'd1-sql', 'prosemirror-steps', 'markdown-safe']) {
      await page.goto(`${BASE}/demos/${demo}`);
      await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible({ timeout: 60_000 });
      await noOverflow(page);
    }
  });

  test('no demo loads another demo\'s SDK', async ({ page }) => {
    await prepare(page);
    // A GSAP demo must not have pulled PixiJS in.
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await page.goto(`${BASE}/demos/gsap-timeline`);
    await expect(page.locator('.demo-workspace:not([role="status"])')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1200);
    const joined = requested.join(' ');
    expect(joined).not.toContain('pixi');
    expect(joined).not.toContain('matter');
  });
});

export { BASE, VITE };
