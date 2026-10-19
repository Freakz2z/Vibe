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
  icon: string;
  logo?: string;
  logoDark?: string;
  featured: boolean;
  platforms: string[];
  pricing: string;
  install?: string;
  demoId?: string;
};

type CatalogRecord = {
  tools: ToolRecord[];
  categories: { id: string; name: string }[];
  demos: { id: string; kind: string }[];
};

const TEST_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0f766e"/></svg>';

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

  // The header owns the only favorites entry; category and demo icons are real SVGs.
  await expect(page.locator('a[href="/?favorites=1"]')).toHaveCount(1);
  await expect(page.locator('.sidebar a[href="/?favorites=1"]')).toHaveCount(0);
  await expect(page.locator('.sidebar__category-icon svg')).toHaveCount(catalog.categories.length);
  await expect(page.locator('.tool-group__icon svg')).toHaveCount(catalog.categories.length);
  await expect(page.locator('.demo-card__kind svg').first()).toBeVisible();

  // Official logos stay on-site; failures fall back to the text mark without hotlinks.
  const shippedLogos = catalog.tools.filter((tool) => tool.logo);
  if (shippedLogos.length > 0) {
    const logoSources = await page
      .locator('.tool-logo img')
      .evaluateAll((images) => images.map((image) => image.getAttribute('src') ?? ''));
    expect(logoSources.length).toBeGreaterThan(0);
    for (const source of logoSources) {
      expect(source.startsWith('/media/icons/'), `logo should be local: ${source}`).toBeTruthy();
    }
  }
  await expect(page.locator('.tool-logo')).toHaveCount(
    catalog.tools.length + catalog.tools.filter((tool) => tool.featured).length,
  );

  const categoryTool = catalog.tools.find((tool) => tool.platforms.includes('Web'));
  expect(categoryTool).toBeTruthy();
  await page.goto(`${BASE}/?category=frontend-ui`);
  await expect(page.locator('.browse-heading h1')).toHaveText('前端与 UI');
  await expect(page.locator('.tool-card').first()).toBeVisible();
  await expect(page.locator('.filter-panel')).toBeVisible();
  await expect(page.locator('.filter-panel__status')).toContainText('个工具');
  const firstCategoryCard = await page.locator('.tool-card').first().boundingBox();
  expect(firstCategoryCard!.y).toBeLessThanOrEqual(460);
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

test('logos use local assets, respect dark variants and fall back safely', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await prepare(page);
  const catalog = await liveCatalog(page);
  const modified = structuredClone(catalog);
  const [lightTool, externalTool, missingTool, darkFailTool] = modified.tools;
  lightTool.logo = '/media/icons/react.svg';
  lightTool.logoDark = '/media/icons/react-dark.svg';
  externalTool.logo = 'https://cdn.example.com/logo.svg';
  delete externalTool.logoDark;
  missingTool.logo = '/media/icons/__qa-missing-light.svg';
  delete missingTool.logoDark;
  darkFailTool.logo = '/media/icons/react.svg';
  darkFailTool.logoDark = '/media/icons/__qa-missing-dark.svg';

  await page.route('**/api/catalog', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(modified),
    }),
  );
  // Only the synthetic QA URLs are fulfilled; every real catalog logo stays real.
  for (const source of ['/media/icons/react.svg', '/media/icons/react-dark.svg']) {
    await page.route(`**${source}`, (route) =>
      route.fulfill({ status: 200, contentType: 'image/svg+xml', body: TEST_LOGO }),
    );
  }
  await page.route('**/media/icons/__qa-missing*.svg', (route) =>
    route.fulfill({ status: 404 }),
  );

  await page.goto(BASE);
  const lightCard = page.locator('.tool-card', { hasText: lightTool.name }).first();
  const lightLogo = lightCard.locator('.tool-logo');
  await expect(lightLogo).toHaveClass(/tool-logo--with-dark/);
  await expect(lightLogo.locator('.tool-logo__img--light')).toHaveAttribute(
    'src',
    '/media/icons/react.svg',
  );
  await expect(lightLogo.locator('.tool-logo__img--dark')).toHaveAttribute(
    'src',
    '/media/icons/react-dark.svg',
  );

  const externalCard = page.locator('.tool-card', { hasText: externalTool.name }).first();
  await expect(externalCard.locator('.tool-logo img')).toHaveCount(0);
  await expect(externalCard.locator('.tool-logo__fallback--light')).toHaveText(externalTool.icon);

  const missingCard = page.locator('.tool-card', { hasText: missingTool.name }).first();
  await missingCard.scrollIntoViewIfNeeded();
  await expect(missingCard.locator('.tool-logo--fallback')).toBeVisible();
  await expect(missingCard.locator('.tool-logo__fallback--light')).toHaveText(missingTool.icon);

  // A dark variant that fails must fall back to the light logo on a light plate.
  const darkFailCard = page.locator('.tool-card', { hasText: darkFailTool.name }).first();
  await darkFailCard.scrollIntoViewIfNeeded();
  const darkFailLogo = darkFailCard.locator('.tool-logo');
  await expect(darkFailLogo.locator('.tool-logo__img--light')).toBeVisible();
  await expect(darkFailLogo).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  await page.evaluate(() => window.localStorage.setItem('vibe-theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const darkCard = page.locator('.tool-card', { hasText: lightTool.name }).first();
  await expect(darkCard.locator('.tool-logo__img--dark')).toBeVisible();
  await expect(darkCard.locator('.tool-logo__img--light')).toBeHidden();
  await expect(darkCard.locator('.tool-logo')).toHaveCSS('background-color', 'rgb(38, 39, 45)');

  const darkFallbackCard = page.locator('.tool-card', { hasText: darkFailTool.name }).first();
  await darkFallbackCard.scrollIntoViewIfNeeded();
  await expect(darkFallbackCard.locator('.tool-logo')).not.toHaveClass(/tool-logo--with-dark/);
  await expect(darkFallbackCard.locator('.tool-logo__img--light')).toBeVisible();
  await expect(darkFallbackCard.locator('.tool-logo')).toHaveCSS(
    'background-color',
    'rgb(244, 244, 241)',
  );

  const missingDarkCard = page.locator('.tool-card', { hasText: missingTool.name }).first();
  await missingDarkCard.scrollIntoViewIfNeeded();
  await expect(missingDarkCard.locator('.tool-logo__fallback--dark')).toBeVisible();
  await expect(missingDarkCard.locator('.tool-logo')).toHaveCSS(
    'background-color',
    'rgb(244, 244, 241)',
  );
});

test('tool detail follows the reading order with one resource card', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await prepare(page);
  const catalog = await liveCatalog(page);
  const tool = catalog.tools.find((item) => item.demoId && item.install && item.logo) ??
    catalog.tools.find((item) => item.demoId && item.install);
  expect(tool, 'fixture should include a tool with install and demo content').toBeTruthy();

  await page.goto(`${BASE}/tools/${tool!.id}`);
  await expect(page.locator('.tool-detail-hero h1')).toHaveText(tool!.name);
  const headings = await page.locator('.tool-detail-main .detail-section h2').allInnerTexts();
  expect(headings).toEqual(['简介', '安装', '适用场景', '特点', '示例']);
  await expect(page.locator('.tool-detail-main h2')).toHaveCount(5);
  await expect(page.locator('.tool-detail-aside .fact-card')).toHaveCount(1);
  await expect(page.locator('.tool-detail-aside h2')).toHaveText(['资料']);
  await expect(page.locator('.tool-detail-hero__icon.tool-logo')).toBeVisible();
  await expect(page.locator('.tool-demo-callout .principle-badge svg')).toBeVisible();

  const prose = await page.locator('.detail-prose').evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      width: element.getBoundingClientRect().width,
      maxWidth: Number.parseFloat(style.maxWidth),
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });
  expect(prose.width).toBeLessThanOrEqual(prose.maxWidth + 1);
  expect(prose.fontSize).toBeGreaterThanOrEqual(14);
  expect(prose.lineHeight).toBeGreaterThanOrEqual(24);

  const install = page.locator('.install-command');
  await expect(install).toBeVisible();
  await expect(install).toHaveCSS('overflow-x', 'auto');
  await noOverflow(page);
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
  await expect(page.locator('.search-result__logo').first()).toBeVisible();
  const searchLogoSrc = await page
    .locator('.search-result__logo img')
    .first()
    .getAttribute('src');
  if (searchLogoSrc) expect(searchLogoSrc.startsWith('/media/icons/')).toBeTruthy();
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

  // Favorites persist on this device and use the header as their only entry.
  await page.goto(`${BASE}/tools/nextjs`);
  await page.locator('.favorite-detail').click();
  await expect(page.locator('.favorite-detail')).toHaveText(/已收藏/);
  await page.reload();
  await expect(page.locator('.favorite-detail')).toHaveText(/已收藏/);

  await expect(page.locator('a[href="/?favorites=1"]')).toHaveCount(1);
  await page.locator('.topbar__favorite-link').click();
  await expect(page).toHaveURL(/favorites=1/);
  await expect(page.locator('.browse-heading h1')).toHaveText('我的收藏');
  expectCopyAbsent(
    await page.locator('.browse-heading').innerText(),
    ['本机短名单', '保存在当前浏览器', '不需要账号', '无需登录'],
  );
  await expect(page.locator('.tool-card').first()).toBeVisible();

  // Demos index and the original principle demos.
  await page.goto(`${BASE}/demos`);
  await expect(page.locator('.demo-card')).toHaveCount(catalog.demos.length);
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
  await expect(page.locator('.tool-detail-main')).toContainText('标准许可');
  await page.goto(`${BASE}/tools/swiftui`);
  await expect(page.locator('.price').first()).toHaveText('免费使用');
  await expect(page.locator('.tool-detail-main')).toContainText('开发者计划');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.getByRole('button', { name: '关于与选型说明' }).first().click();
  const about = page.getByRole('dialog', { name: '关于 Vibe 工具集' });
  await expect(about).toBeVisible();
  await expect(about).toContainText('收藏与主题偏好保存在浏览器的 localStorage 中');
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});

test('filter combinations stay shareable and can be removed one by one', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepare(page);
  const catalog = await liveCatalog(page);
  const expected = catalog.tools.filter(
    (tool) => tool.platforms.includes('Web') && tool.pricing === '开源免费',
  ).length;

  await page.goto(`${BASE}/?platform=Web&pricing=${encodeURIComponent('开源免费')}`);
  await expect(page.locator('.browse-heading h1')).toHaveText('筛选结果');
  await expect(page.locator('.filter-panel__groups')).toContainText('平台');
  await expect(page.locator('.filter-panel__groups')).toContainText('费用');
  await expect(page.locator('.filter-panel .active-filter')).toHaveCount(2);
  await expect(page.locator('.filter-panel').getByRole('button', { name: '全部重置' })).toHaveCount(1);
  await expect(page.locator('.filter-panel__status')).toHaveText(`共 ${expected} 个工具`);
  await expect(page.locator('.tool-card')).toHaveCount(expected);
  await expect(page.getByRole('button', { name: 'Web', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Shared URL restores both conditions.
  await page.reload();
  await expect(page.locator('.filter-panel .active-filter')).toHaveCount(2);
  await expect(page.locator('.tool-card')).toHaveCount(expected);

  await page.getByRole('button', { name: '移除平台：Web' }).click();
  await expect(page).not.toHaveURL(/platform=/);
  await expect(page).toHaveURL(/pricing=/);
  await expect(page.locator('.filter-panel .active-filter')).toHaveCount(1);
  await expect(page.locator('.tool-card')).toHaveCount(
    catalog.tools.filter((tool) => tool.pricing === '开源免费').length,
  );

  await page.locator('.filter-panel .active-filter__reset').click();
  await expect(page).toHaveURL(`${BASE}/`);
  await expect(page.locator('.filter-panel .active-filter')).toHaveCount(0);
  await expect(page.locator('.tool-card')).toHaveCount(catalog.tools.length);
  await noOverflow(page);
});

test('search into a filtered detail restores the directory, and history restores scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepare(page);
  await liveCatalog(page);

  // Search from a filtered directory keeps filters in the detail URL and back link.
  await page.goto(`${BASE}/?category=frontend-ui&platform=Web`);
  await expect(page.locator('.filter-panel .active-filter')).toHaveCount(2);
  await page.getByRole('button', { name: '打开搜索' }).click();
  await page.getByRole('combobox').fill('React');
  await page.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/\/tools\/react\?category=frontend-ui&platform=Web/);
  await page.getByRole('link', { name: '返回目录' }).click();
  await expect(page).toHaveURL(/\/\?category=frontend-ui&platform=Web/);
  await expect(page.locator('.filter-panel .active-filter')).toHaveCount(2);

  // Directory -> detail -> related tool -> return still carries filters and position.
  await page.goto(`${BASE}/?category=frontend-ui`);
  await expect(page.locator('.tool-card').first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 650));
  await page.waitForTimeout(100);
  const filteredScroll = await page.evaluate(() => window.scrollY);
  expect(filteredScroll).toBeGreaterThan(400);
  await page.locator('.tool-card__hit').first().evaluate((element) => (element as HTMLElement).click());
  await expect(page.locator('.tool-detail-hero h1')).toBeVisible();
  const related = page.locator('.related-item').first();
  await expect(related).toBeVisible();
  await expect(related).toHaveAttribute('href', /\?category=frontend-ui$/);
  await related.click();
  await expect(page).toHaveURL(/\/tools\/[^?]+\?category=frontend-ui$/);
  await expect(page.locator('.tool-detail-hero h1')).toBeVisible();
  await page.getByRole('link', { name: '返回目录' }).click();
  await expect(page).toHaveURL(/\/\?category=frontend-ui$/);
  await expect(page.locator('.filter-panel .active-filter')).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(filteredScroll - 40);

  // Open a card from deep in the directory, then use history and breadcrumb back.
  await page.goto(BASE);
  await expect(page.locator('.tool-card__hit').first()).toBeVisible();
  const target = page.locator('.tool-card__hit').nth(8);
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 1100));
  await page.waitForTimeout(120);
  const savedScroll = await page.evaluate(() => window.scrollY);
  expect(savedScroll).toBeGreaterThan(600);
  await target.evaluate((element) => (element as HTMLElement).click());
  await expect(page.locator('.tool-detail-hero h1')).toBeVisible();
  await expect(page).toHaveURL(/\/tools\//);

  await page.goBack();
  await expect(page).toHaveURL(`${BASE}/`);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(savedScroll - 40);

  await page.goForward();
  await expect(page.locator('.tool-detail-hero h1')).toBeVisible();
  await page.getByRole('link', { name: '返回目录' }).click();
  await expect(page).toHaveURL(`${BASE}/`);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(savedScroll - 40);
});

test('scroll restoration waits for catalog content after reload and back', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepare(page);

  // Slow every catalog response so the loading screen is observable.
  await page.route('**/api/catalog', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (MOCK) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: catalogFixture!,
      });
      return;
    }
    const response = await route.fetch();
    await route.fulfill({ response });
  });

  await page.goto(BASE);
  await expect(page.locator('.tool-card').first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(100);
  const savedScroll = await page.evaluate(() => window.scrollY);
  expect(savedScroll).toBeGreaterThan(600);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.startup-screen')).toBeVisible();
  await expect(page.locator('.tool-card').first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(savedScroll - 40);

  // Repeat the round trip through a detail page, reloading it before returning.
  const target = page.locator('.tool-card__hit').nth(5);
  await target.evaluate((element) => (element as HTMLElement).click());
  await expect(page.locator('.tool-detail-hero h1')).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.startup-screen')).toBeVisible();
  await expect(page.locator('.tool-detail-hero h1')).toBeVisible();
  await page.getByRole('link', { name: '返回目录' }).click();
  await page.waitForURL(`${BASE}/`);
  await expect(page.locator('.tool-card').first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(savedScroll - 40);
});

test('favorites dedupe, count, filter rescue and unfavorite stay in sync', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await prepare(page);
  await liveCatalog(page);

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'vibe-favorites',
      JSON.stringify(['react', 'react', 'nextjs', 'nextjs']),
    );
  });
  await page.goto(`${BASE}/?favorites=1`);
  await expect(page.locator('.browse-heading h1')).toHaveText('我的收藏');
  await expect(page.locator('.browse-heading__count')).toHaveText('共 2 个工具');
  await expect(page.locator('.tool-card')).toHaveCount(2);
  await expect(page.locator('.topbar__favorite-count')).toHaveText('2');

  // A filter that excludes every favorite offers a one-click rescue.
  await page.goto(`${BASE}/?favorites=1&platform=CLI`);
  await expect(page.locator('.empty-state')).toBeVisible();
  await page.getByRole('button', { name: '清除筛选，查看全部收藏' }).click();
  await expect(page).toHaveURL(/\/\?favorites=1$/);
  await expect(page.locator('.tool-card')).toHaveCount(2);

  await page.locator('.favorite-button').first().click();
  await expect(page.locator('.tool-card')).toHaveCount(1);
  await expect(page.locator('.topbar__favorite-count')).toHaveText('1');
  await page.locator('.favorite-button').first().click();
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('.topbar__favorite-count')).toHaveCount(0);
  await expect(page.locator('.sidebar a[href="/?favorites=1"]')).toHaveCount(0);
});

test('hover feedback never shifts cards, navigation or buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepare(page);
  await liveCatalog(page);
  await page.goto(BASE);
  await expect(page.locator('.tool-card').first()).toBeVisible();

  const landingTargets: [string, Locator][] = [
    ['featured card', page.locator('.featured-tool').first()],
    ['tool card', page.locator('.tool-card').first()],
    ['demo card', page.locator('.demo-card').first()],
    ['sidebar navigation item', page.locator('.sidebar__item').first()],
    ['filter chip', page.locator('.filter-chip').first()],
    ['favorite entry', page.locator('.topbar__favorite-link')],
    ['favorite button', page.locator('.favorite-button').first()],
    ['primary button', page.locator('.button--primary').first()],
    ['search trigger', page.locator('.search-trigger')],
  ];

  for (const [label, target] of landingTargets) {
    await expectHoverStable(page, target, label);
  }

  await page.getByRole('button', { name: 'Web', exact: true }).click();
  await expect(page).toHaveURL(/platform=Web/);
  const filteredTargets: [string, Locator][] = [
    ['active filter remove', page.locator('.filter-panel .active-filter__remove').first()],
    ['active filter reset', page.locator('.filter-panel .active-filter__reset')],
    ['tool card', page.locator('.tool-card').first()],
  ];
  for (const [label, target] of filteredTargets) {
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
      await expect(page.locator('.topbar__favorite-link')).toBeVisible();
      await expect(page.locator('.sidebar a[href="/?favorites=1"]')).toHaveCount(0);

      // The mobile menu closes itself once a destination is chosen.
      await page.getByRole('button', { name: '打开分类导航' }).click();
      const drawer = page.getByRole('dialog', { name: '分类导航' });
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('a[href="/?favorites=1"]')).toHaveCount(0);
      await drawer.getByRole('button', { name: /前端与 UI/ }).click();
      await expect(drawer).toHaveCount(0);
      await expect(page).toHaveURL(/category=frontend-ui/);
      await noOverflow(page);

      // Mobile filters open as a keyboard-friendly sheet with named removal.
      await page.goto(BASE);
      await expect(page.locator('.filter-mobile-bar')).toBeVisible();
      await expect(page.locator('.filter-panel')).toBeHidden();
      await page.locator('.filter-toggle').click();
      const sheet = page.getByRole('dialog', { name: '筛选' });
      await expect(sheet).toBeVisible();
      await expect(page.getByRole('button', { name: '关闭筛选' })).toBeFocused();
      await sheet.getByRole('button', { name: '命令行', exact: true }).click();
      await expect(page).toHaveURL(/platform=CLI/);
      await expect(page.locator('.filter-sheet__status')).toContainText('个工具');
      await expect(sheet.getByRole('button', { name: '全部重置' })).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await expect(page.locator('.filter-toggle')).toBeFocused();
      await expect(page.locator('.filter-mobile-bar .active-filter')).toContainText('平台：命令行');
      await page.locator('.filter-mobile-bar .active-filter__remove').click();
      await expect(page).not.toHaveURL(/platform=/);
      await noOverflow(page);

      // A long install command scrolls inside its own block, never the page.
      await page.goto(`${BASE}/tools/tiptap`);
      await expect(page.locator('.install-command')).toBeVisible();
      const installMetrics = await page.locator('.install-command').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          overflowX: window.getComputedStyle(element).overflowX,
          right: rect.right,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      });
      expect(installMetrics.overflowX).toBe('auto');
      expect(installMetrics.right).toBeLessThanOrEqual(width);
      expect(installMetrics.scrollWidth).toBeGreaterThanOrEqual(installMetrics.clientWidth);
      await noOverflow(page);

      await page.goto(BASE);
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
  // Light-only official marks keep a light plate in dark mode.
  if ((await page.locator('.tool-logo:not(.tool-logo--with-dark)').count()) > 0) {
    await expect(page.locator('.tool-logo:not(.tool-logo--with-dark)').first()).toHaveCSS(
      'background-color',
      'rgb(244, 244, 241)',
    );
  }
  if ((await page.locator('.tool-logo--with-dark').count()) > 0) {
    await expect(page.locator('.tool-logo--with-dark').first()).toHaveCSS(
      'background-color',
      'rgb(38, 39, 45)',
    );
  }
  await noOverflow(page);
  await page.screenshot({ path: `${shots}/accept-home-dark.png` });
});

test('dark theme remains readable with mobile filters', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.setItem('vibe-theme', 'dark'));
  await prepare(page);
  await page.goto(BASE);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.filter-toggle').click();
  const sheet = page.getByRole('dialog', { name: '筛选' });
  await expect(sheet).toBeVisible();
  await expect(page.getByRole('button', { name: '关闭筛选' })).toBeFocused();
  await expect(sheet.locator('.filter-chip').first()).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `${shots}/accept-filter-dark-390.png` });
});

test('expanded catalog, demo search and rightmost source link', async ({ page }) => {
  await page.goto(BASE);
  const catalog = await liveCatalog(page);
  expect(catalog.tools.length).toBeGreaterThan(200);
  expect(catalog.demos.length).toBeGreaterThan(20);
  const source = page.getByRole('link', {name: 'GitHub 开源仓库'});
  await expect(source).toHaveAttribute('href', 'https://github.com/Freakz2z/Vibe');
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(page.locator('.topbar__actions > :last-child')).toHaveClass(/topbar__github/);
  await page.goto(`${BASE}/demos`);
  await expect(page.locator('.demo-card')).toHaveCount(catalog.demos.length);
  await page.getByRole('searchbox', {name: '搜索示例'}).fill('缓存');
  await expect(page.locator('.demo-card')).toHaveCount(1);
  await page.locator('.demo-card').click();
  await expect(page).toHaveURL(/cache-lab$/);
  await expect(page.getByRole('button', {name: '同时请求 3 次'})).toBeVisible();
  await page.goto(`${BASE}/tools/codemirror`);
  await expect(page.locator('.tool-detail-hero__actions a', {hasText: '源码'})).toHaveAttribute('href', 'https://code.haverbeke.berlin/codemirror/view');
});

test('expanded labs run at desktop and mobile widths without page overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE);
  const catalog = await liveCatalog(page);
  for (const width of [1280, 320]) {
    await page.setViewportSize({width, height: 900});
    for (const demo of catalog.demos) {
      await page.goto(`${BASE}/demos/${demo.id}`);
      await expect(page.locator('.demo-workspace[aria-label]')).toBeVisible();
      await noOverflow(page);
    }
  }
  expect(errors).toEqual([]);
});

test('expanded CSS and graphics labs respond to input', async ({ page }) => {
  await page.goto(`${BASE}/demos/contrast-lab`);
  await page.getByLabel('文字颜色', {exact: true}).fill('#000000');
  await page.getByLabel('背景颜色', {exact: true}).fill('#ffffff');
  await expect(page.locator('.lab-metric')).toHaveText('21.00 : 1');
  await page.goto(`${BASE}/demos/grid-playground`);
  await page.getByLabel('列数', {exact: true}).fill('4');
  await expect(page.locator('.lab-code')).toContainText('repeat(4, minmax(0, 1fr))');
  await page.goto(`${BASE}/demos/flex-playground`);
  await page.getByLabel('排列方向').selectOption('column');
  await expect(page.locator('.lab-flex')).toHaveCSS('flex-direction','column');
  await page.goto(`${BASE}/demos/shadow-studio`);
  await page.getByLabel('模糊半径', {exact:true}).fill('40');
  await expect(page.locator('.lab-code')).toContainText('40px');
  await page.goto(`${BASE}/demos/type-scale`);
  await page.getByLabel('基础字号', {exact:true}).fill('20');
  await expect(page.locator('.lab-code')).toContainText('--text-0: 20px');
  await page.goto(`${BASE}/demos/svg-path`);
  await page.getByLabel('控制点 X', {exact:true}).fill('300');
  await expect(page.locator('.lab-code')).toContainText('Q 300 20');
  await page.goto(`${BASE}/demos/bezier-editor`);
  await page.getByRole('button',{name:'播放',exact:true}).click();
  await expect.poll(()=>page.locator('.lab-bezier-ball').evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);
  await page.goto(`${BASE}/demos/noise-texture`);
  const initial = await page.getByRole('link',{name:'下载 PNG'}).getAttribute('href');
  await page.getByLabel('随机种子', {exact:true}).fill('30');
  await expect(page.getByRole('link',{name:'下载 PNG'})).not.toHaveAttribute('href',initial!);
});

test('expanded data labs parse user input and stop pathological regex', async ({ page }) => {
  await page.goto(`${BASE}/demos/json-explorer`);
  await page.getByLabel('JSON 输入').fill('{"safe":"<img onerror=alert(1)>"}');
  await expect(page.locator('.lab-code')).toContainText('<img onerror=alert(1)>');
  await expect(page.locator('.lab-code img')).toHaveCount(0);
  await page.getByLabel('JSON 输入').fill('{bad');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.goto(`${BASE}/demos/csv-explorer`);
  await page.getByLabel('CSV 输入').fill('name,note\nVue,"a,b"\nReact,"a""b"');
  await expect(page.locator('.lab-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.lab-table')).toContainText('a,b');
  await expect(page.locator('.lab-code')).toContainText('a\\"b');
  await page.goto(`${BASE}/demos/regex-lab`);
  await expect(page.locator('.lab-matches li')).toHaveCount(3);
  await page.getByLabel('正则规则').fill('[');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('正则规则').fill('(a+)+$');
  await page.getByLabel('测试文本').fill('a'.repeat(80)+'!');
  await expect(page.getByRole('alert')).toContainText('超过 300ms');
  await page.getByLabel('正则规则').fill('a+');
  await expect(page.locator('.lab-matches li')).toHaveCount(1);
});

test('expanded sorting, debounce and cache perform real state transitions', async ({ page }) => {
  await page.goto(`${BASE}/demos/sorting-lab`);
  for (const algorithm of ['bubble','insertion']) {
    await page.getByLabel('排序算法').selectOption(algorithm);
    await page.getByRole('button',{name:'完成排序',exact:true}).click();
    const values = (await page.locator('.lab-sort-bar').allTextContents()).map(Number);
    expect(values).toEqual([...values].sort((a,b)=>a-b));
    await expect(page.locator('.lab-status')).toContainText('排序完成');
  }
  await page.goto(`${BASE}/demos/debounce-lab`);
  await page.getByRole('button',{name:'连续触发 10 次'}).click();
  await expect(page.locator('.lab-stats > div').nth(0).locator('strong')).toHaveText('10');
  await expect(page.locator('.lab-stats > div').nth(1).locator('strong')).toHaveText('1');
  await page.goto(`${BASE}/demos/cache-lab`);
  await page.getByRole('button',{name:'同时请求 3 次'}).click();
  await expect(page.locator('.lab-stats > div').nth(0).locator('strong')).toHaveText('1');
  await expect(page.locator('.lab-stats > div').nth(2).locator('strong')).toHaveText('2');
  await expect(page.locator('.lab-status')).toContainText('模拟请求完成');
  await page.getByRole('button',{name:'请求数据',exact:true}).click();
  await expect(page.locator('.lab-stats > div').nth(1).locator('strong')).toHaveText('1');
  await page.getByRole('button',{name:'清除缓存',exact:true}).click();
  await page.getByRole('button',{name:'请求数据',exact:true}).click();
  await expect(page.locator('.lab-stats > div').nth(0).locator('strong')).toHaveText('2');
});

test('expanded image lab processes selected images locally and supports dark mobile', async ({ page }) => {
  const requests: string[]=[];
  page.on('request',r=>{if(r.method()!=='GET')requests.push(r.url());});
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${BASE}/demos/image-export`);
  await page.getByLabel('选择本地图片').setInputFiles(path.resolve(process.cwd(),'public/brand/logo.png'));
  await expect(page.locator('.lab-image img')).toBeVisible();
  await expect(page.getByRole('link',{name:'下载图片'})).toHaveAttribute('download','vibe-export.webp');
  await page.getByLabel('输出格式').selectOption('image/png');
  await expect(page.getByRole('link',{name:'下载图片'})).toHaveAttribute('download','vibe-export.png');
  await page.evaluate(()=>window.localStorage.setItem('vibe-theme','dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await noOverflow(page);
  expect(requests).toEqual([]);
});
