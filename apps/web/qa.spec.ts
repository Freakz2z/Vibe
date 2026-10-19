import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.env.VIBE_TEST_BASE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const MOCK = process.env.VIBE_TEST_MOCK === '1';
const catalogFixture = MOCK
  ? readFileSync(path.resolve(process.cwd(), '../../data/catalog.json'), 'utf8')
  : null;
const shots = path.resolve(process.cwd(), 'qa-shots');
mkdirSync(shots, { recursive: true });

type ToolRecord = {
  id: string;
  name: string;
  featured: boolean;
  platforms: string[];
  pricing: string;
};

type CatalogRecord = {
  tools: ToolRecord[];
  categories: { id: string; name: string }[];
  demos: { id: string; kind: string }[];
};

async function prepare(page: Page) {
  if (!MOCK) return;
  await page.route('**/api/catalog', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: catalogFixture! }),
  );
}

async function liveCatalog(page: Page): Promise<CatalogRecord> {
  if (MOCK) return JSON.parse(catalogFixture!) as CatalogRecord;
  const response = await page.request.get(`${BASE}/api/catalog`);
  expect(response.ok(), `GET /api/catalog responded ${response.status()}`).toBeTruthy();
  return (await response.json()) as CatalogRecord;
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}

const REMOVED_COPY = [
  '把对味的工具',
  '放进同一条工作流',
  '从 AI 编程到移动开发',
  '先从这里看',
  '先动手，再决定',
  '收藏保存在本机',
  '无需登录',
  '收藏只写入本机浏览器',
  '收藏仅存本机',
  '本机短名单',
  '这些工具只保存在当前浏览器',
  '覆盖不同环节的八个起点',
  '精选怎么用',
  '精选会随目录整理调整',
  '按分类铺开的选择',
  '关键词会同时匹配',
  '平台与授权条件会即时筛选',
  '试试更短的关键词',
];

function expectCopyAbsent(text: string, copy: string[]) {
  for (const phrase of copy) {
    expect(text, `removed copy should not appear: ${phrase}`).not.toContain(phrase);
  }
}

async function expectHoverStable(page: Page, target: Locator, label: string) {
  await target.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(220);
  const before = await target.boundingBox();
  expect(before, `${label} should have a bounding box before hover`).not.toBeNull();

  await target.hover();
  await page.waitForTimeout(280);
  const after = await target.boundingBox();
  expect(after, `${label} should have a bounding box after hover`).not.toBeNull();

  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(
      Math.abs(after![key] - before![key]),
      `${label} ${key} should not change on hover`,
    ).toBeLessThanOrEqual(0.5);
  }
}

const DEMO_ROUTES = [
  'spring-lab',
  'chart-studio',
  'gradient-studio',
  'kanban-board',
  'particle-field',
  'markdown-desk',
];

const ALL_ROUTES = [
  '/',
  '/tools/react',
  '/demos',
  ...DEMO_ROUTES.map((id) => `/demos/${id}`),
];

test('live catalog, all required routes and compact first screens', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepare(page);
  const catalog = await liveCatalog(page);

  await page.goto(BASE);
  await expect(page.locator('.hero')).toBeVisible();
  await expect(page.locator('.hero__actions')).toBeVisible();
  await expect(page.locator('.hero__stats')).toBeVisible();
  await expect(page.locator('.hero h1')).toHaveCount(0);
  await expect(page.locator('.featured-tool').first()).toBeVisible();
  await expect(page.locator('.featured-tool')).toHaveCount(
    catalog.tools.filter((tool) => tool.featured).length,
  );
  expectCopyAbsent(await page.locator('body').innerText(), REMOVED_COPY);

  const heroHeight = await page.locator('.hero').evaluate((element) => element.getBoundingClientRect().height);
  expect(heroHeight).toBeGreaterThanOrEqual(140);
  expect(heroHeight).toBeLessThanOrEqual(340);
  const firstFeatured = page.locator('.featured-tool').first();
  await expect(firstFeatured).toBeInViewport({ ratio: 0.5 });
  const firstFeaturedBox = await firstFeatured.boundingBox();
  expect(firstFeaturedBox!.y).toBeLessThan(720);
  await noOverflow(page);
  await page.screenshot({ path: `${shots}/accept-home-1280.png` });

  const categoryTool = catalog.tools.find((tool) => tool.platforms.includes('Web'));
  expect(categoryTool).toBeTruthy();
  await page.goto(`${BASE}/?category=frontend-ui`);  await expect(page.locator('.browse-heading h1')).toHaveText('前端与 UI');
  await expect(page.locator('.tool-card').first()).toBeVisible();
  const firstCategoryCard = await page.locator('.tool-card').first().boundingBox();
  expect(firstCategoryCard!.y).toBeLessThanOrEqual(330);
  await noOverflow(page);
  await page.screenshot({ path: `${shots}/accept-category-1280.png` });

  // Every required route renders the expected page and avoids horizontal overflow.
  for (const route of ALL_ROUTES) {
    await page.goto(`${BASE}${route}`);
    await expect(page.locator('main')).toBeVisible();
    await noOverflow(page);
    if (route === '/tools/react') {
      await expect(page.locator('.tool-detail-hero h1')).toHaveText('React');
      await expect(page.getByRole('link', { name: /访问官网/ })).toHaveAttribute('target', '_blank');
      const rel = await page.getByRole('link', { name: /访问官网/ }).getAttribute('rel');
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    } else if (route === '/demos') {
      await expect(page.locator('.demo-card')).toHaveCount(catalog.demos.length);
    } else if (route.startsWith('/demos/')) {
      await expect(page.locator('.demo-workspace')).toBeVisible();
    }
  }

  expect(errors).toEqual([]);
});

test('filters, search, favorites, demos and safe markdown', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepare(page);
  const catalog = await liveCatalog(page);

  await page.goto(BASE);
  await expect(page.locator('.tool-card').first()).toBeVisible();
  expectCopyAbsent(await page.locator('.sidebar').innerText(), ['收藏保存在本机', '无需登录']);
  expectCopyAbsent(await page.locator('.site-footer').innerText(), ['收藏仅存本机']);
  expectCopyAbsent(await page.locator('.site-footer').innerText(), ['为独立开发者与 AI 编程创造者整理的中文工具导航']);

  await page.getByRole('button', { name: '打开搜索' }).click();
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.getByRole('combobox').fill('图表');
  await expect(page.locator('.search-result').first()).toBeVisible();
  await page.getByRole('combobox').fill('zzz-no-such-tool');
  await expect(page.locator('.search-empty')).toBeVisible();
  expectCopyAbsent(await page.locator('.search-dialog').innerText(), ['试试更短的关键词']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).toHaveCount(0);

  const cliCount = catalog.tools.filter((tool) => tool.platforms.includes('CLI')).length;
  await page.getByRole('button', { name: '命令行', exact: true }).click();
  await expect(page).toHaveURL(/platform=CLI/);
  await expect(page.locator('.tool-card')).toHaveCount(cliCount);
  await page.getByRole('button', { name: '全部', exact: true }).first().click();
  await expect(page).not.toHaveURL(/platform=CLI/);

  // Four pricing categories remain independently selectable.
  await page.getByRole('button', { name: '免费使用', exact: true }).click();
  await expect(page).toHaveURL(/pricing=%E5%85%8D%E8%B4%B9%E4%BD%BF%E7%94%A8/);
  await expect(page.locator('.tool-card')).toHaveCount(
    catalog.tools.filter((tool) => tool.pricing === '免费使用').length,
  );
  await page.getByRole('button', { name: '开源免费', exact: true }).click();
  await expect(page).toHaveURL(/pricing=%E5%BC%80%E6%BA%90%E5%85%8D%E8%B4%B9/);
  await expect(page.locator('.tool-card')).toHaveCount(
    catalog.tools.filter((tool) => tool.pricing === '开源免费').length,
  );
  await page.goto(`${BASE}/?pricing=all`);

  // Favorites persist on this device.
  await page.goto(`${BASE}/tools/nextjs`);
  await page.getByRole('button', { name: /收藏到本机|已收藏/ }).click();
  await expect(page.getByRole('button', { name: '已收藏' }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '已收藏' }).first()).toBeVisible();

  await page.goto(`${BASE}/?favorites=1`);
  await expect(page.locator('.browse-heading h1')).toHaveText('我的收藏');
  expectCopyAbsent(
    await page.locator('.browse-heading').innerText(),
    ['本机短名单', '保存在当前浏览器', '不需要账号', '无需登录'],
  );
  await expect(page.locator('.tool-card').first()).toBeVisible();

  // Demos index and all six principle demos.
  await page.goto(`${BASE}/demos`);
  await expect(page.locator('.demo-card')).toHaveCount(6);
  expectCopyAbsent(
    await page.locator('.demos-page').innerText(),
    ['六个可以动手的小实验', '想让你在挑工具前先感受交互本身'],
  );
  for (const id of DEMO_ROUTES) {
    await page.goto(`${BASE}/demos/${id}`);
    await expect(page.locator('.demo-workspace')).toBeVisible();
    await noOverflow(page);
  }

  // Markdown never renders untrusted HTML and code spans win over bold markers.
  await page.goto(`${BASE}/demos/markdown-desk`);
  await expect(page.locator('.markdown-preview li code').first()).toHaveText('**粗体**');
  const maxLength = await page.locator('#markdown-source').getAttribute('maxlength');
  expect(Number(maxLength)).toBeGreaterThan(0);
  await page.locator('#markdown-source').fill('<img src=x onerror="window.__xss=1"> **安全**');
  await expect(page.locator('.markdown-preview img')).toHaveCount(0);
  await expect(page.locator('.markdown-preview strong')).toHaveText('安全');
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

  // Kanban move buttons work without drag; spring respects reduced motion.
  await page.goto(`${BASE}/demos/kanban-board`);
  await page
    .getByRole('button', { name: /将「梳理导航信息架构」移到进行中/ })
    .click();
  await expect(
    page.getByRole('button', { name: /将「梳理导航信息架构」移到已完成/ }),
  ).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/demos/spring-lab`);
  await expect(page.locator('.spring-ball')).toBeVisible();

  await page.goto(`${BASE}/tools/gsap`);
  await expect(page.locator('.price').first()).toHaveText('免费使用');
  await expect(page.locator('.tool-detail-hero')).toContainText('标准许可');
  await page.goto(`${BASE}/tools/swiftui`);
  await expect(page.locator('.price').first()).toHaveText('免费使用');
  await expect(page.locator('.tool-detail-hero')).toContainText('开发者计划');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.getByRole('button', { name: '关于与选型说明' }).first().click();
  const about = page.getByRole('dialog', { name: '关于 Vibe 工具集' });
  await expect(about).toBeVisible();
  await expect(about).toContainText('收藏与主题偏好保存在浏览器的 localStorage 中');
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});

test('hover feedback never shifts cards, navigation or buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepare(page);
  await liveCatalog(page);
  await page.goto(BASE);
  await expect(page.locator('.tool-card').first()).toBeVisible();

  const targets: [string, Locator][] = [
    ['featured card', page.locator('.featured-tool').first()],
    ['tool card', page.locator('.tool-card').first()],
    ['demo card', page.locator('.demo-card').first()],
    ['sidebar navigation item', page.locator('.sidebar__item').first()],
    ['filter chip', page.locator('.filter-chip').first()],
    ['favorite button', page.locator('.favorite-button').first()],
    ['primary button', page.locator('.button--primary').first()],
    ['search trigger', page.locator('.search-trigger')],
  ];

  for (const [label, target] of targets) {
    await expectHoverStable(page, target, label);
  }

  await page.goto(`${BASE}/tools/react`);
  await expectHoverStable(page, page.locator('.related-item').first(), 'related tool item');
});

test('unknown tool returns the 404 UI with only its own navigation error', async ({ page }) => {
  const errors: string[] = [];
  const missingPath = '/tools/__missing-tool-for-qa__';

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const url = message.location().url;
    const text = message.text();
    // The static host intentionally answers unknown tool URLs with HTTP 404.
    // Allow only that exact navigation error; everything else still fails the test.
    if (url.endsWith(missingPath) && /404/.test(text)) return;
    errors.push(`${text} (${url})`);
  });

  await prepare(page);
  const response = await page.goto(`${BASE}${missingPath}`);
  expect(response?.status()).toBe(404);
  await expect(page.locator('.notfound-page')).toBeVisible();
  await expect(page.locator('.notfound-page h1')).toHaveText('这个工具暂时不在目录里');
  expect(errors).toEqual([]);
});

test.describe('mobile widths', () => {
  for (const width of [320, 390]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await prepare(page);
      await liveCatalog(page);

      for (const route of ALL_ROUTES) {
        await page.goto(`${BASE}${route}`);
        await expect(page.locator('main')).toBeVisible();
        await noOverflow(page);
      }

      await page.goto(BASE);
      await expect(page.locator('.hero')).toBeVisible();
      await page.getByRole('button', { name: '打开分类导航' }).click();
      await expect(page.getByRole('dialog', { name: '分类导航' })).toBeVisible();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '打开搜索' }).click();
      await page.getByRole('combobox').fill('Next');
      await page.getByRole('combobox').press('Enter');
      await expect(page).toHaveURL(/\/tools\/nextjs/);
      await noOverflow(page);
      await page.screenshot({ path: `${shots}/accept-home-${width}.png` });
    });
  }
});

test('dark theme tokens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => window.localStorage.setItem('vibe-theme', 'dark'));
  await prepare(page);
  await page.goto(BASE);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await noOverflow(page);
  await page.screenshot({ path: `${shots}/accept-home-dark.png` });
});
