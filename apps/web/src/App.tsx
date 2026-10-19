import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog, Category, Tool } from './types';
import { fetchCatalog } from './lib/api';
import { filterTools, type ToolFilters } from './lib/catalog';
import { navigate, useRoute, withCurrentSearch } from './lib/router';
import { writeClipboard } from './lib/clipboard';
import { useTheme } from './hooks/useTheme';
import { useFavorites } from './hooks/useFavorites';
import { useDialog } from './hooks/useDialog';
import { Topbar } from './components/Topbar';
import { Sidebar, type SidebarActive } from './components/Sidebar';
import { Footer } from './components/Footer';
import { SearchDialog } from './components/SearchDialog';
import { AboutDialog } from './components/AboutDialog';
import { Toast, type ToastData } from './components/Toast';
import { ErrorScreen, LoadingScreen } from './components/StartupScreens';
import { HomePage } from './pages/HomePage';
import { ToolPage } from './pages/ToolPage';
import { DemosPage } from './pages/DemosPage';
import { DemoPage } from './pages/DemoPage';
import { NotFoundPage } from './pages/NotFoundPage';

const BASE_TITLE = 'Vibe 工具集 · 独立开发者的中文工具导航';
const BASE_DESCRIPTION =
  'Vibe 工具集是一份面向独立开发者与 AI 编程创造者的中文工具导航：按分类浏览前端、动效、图表、后端、移动端与效率工具，支持搜索、平台筛选与本机收藏。';

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

type LoadStatus = 'loading' | 'ready' | 'error';

export default function App() {
  const route = useRoute();
  const pathname = route.pathname.length > 1 ? route.pathname.replace(/\/+$/, '') : '/';
  const params = useMemo(() => new URLSearchParams(route.search), [route.search]);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastId = useRef(0);

  const theme = useTheme();
  const favorites = useFavorites();
  const drawerRef = useRef<HTMLDivElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);

  useDialog(drawerOpen, drawerRef, closeDrawer);

  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus('loading');
    setErrorMessage('');

    fetchCatalog(controller.signal)
      .then((data) => {
        setCatalog(data);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          error instanceof Error ? error.message : '目录服务暂时没有回应，请稍后重试。',
        );
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setDrawerOpen(false);
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || anchor.target || anchor.hasAttribute('download')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

      event.preventDefault();
      setSearchOpen(false);
      setDrawerOpen(false);
      navigate(`${url.pathname}${url.search}${url.hash}`);
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  const notify = useCallback((text: string, tone: ToastData['tone'] = 'default') => {
    toastId.current += 1;
    setToast({ id: toastId.current, text, tone });
  }, []);

  const handleCopy = useCallback(
    async (text: string, label: string) => {
      const success = await writeClipboard(text);
      notify(success ? `已复制${label}` : `复制${label}失败，请手动选择。`, success ? 'default' : 'error');
      return success;
    },
    [notify],
  );

  const handleCopyInstall = useCallback(
    (tool: Tool) => {
      if (!tool.install) return;
      void handleCopy(tool.install, '安装命令');
    },
    [handleCopy],
  );

  const handleToggleFavorite = useCallback(
    (tool: Tool) => {
      const isNowFavorite = favorites.toggle(tool.id);
      notify(isNowFavorite ? `已收藏 ${tool.name}` : `已取消收藏 ${tool.name}`);
    },
    [favorites, notify],
  );

  const openSearch = useCallback(() => {
    setDrawerOpen(false);
    setSearchOpen(true);
  }, []);

  const openAbout = useCallback(() => {
    setDrawerOpen(false);
    setAboutOpen(true);
  }, []);

  const filters = useMemo<ToolFilters>(() => {
    const categoryParam = params.get('category') ?? '';
    const platformParam = params.get('platform') ?? '';
    const pricingParam = params.get('pricing') ?? '';
    const category = catalog?.categories.some((item) => item.id === categoryParam)
      ? categoryParam
      : '';
    const platform = ['Web', 'Mobile', 'CLI'].includes(platformParam) ? platformParam : '';
    const pricing = ['开源免费', '免费使用', '免费增值', '付费'].includes(pricingParam)
      ? pricingParam
      : '';

    return {
      q: (params.get('q') ?? '').slice(0, 120),
      category,
      platform,
      pricing,
      favorites: params.get('favorites') === '1',
      featured: params.get('featured') === '1',
    };
  }, [catalog, params]);

  const favoriteSet = useMemo(() => new Set(favorites.ids), [favorites.ids]);

  const visibleTools = useMemo(() => {
    if (!catalog) return [];
    return filterTools(catalog.tools, catalog.categories, filters, favoriteSet);
  }, [catalog, favoriteSet, filters]);

  const toolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of catalog?.tools ?? []) {
      counts.set(tool.categoryId, (counts.get(tool.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [catalog]);

  const toolMatch = /^\/tools\/([^/]+)$/.exec(pathname);
  const demoMatch = /^\/demos\/([^/]+)$/.exec(pathname);
  const requestedToolId = toolMatch ? decodeSegment(toolMatch[1]) : null;
  const requestedDemoId = demoMatch ? decodeSegment(demoMatch[1]) : null;

  const selectedTool = requestedToolId
    ? catalog?.tools.find((tool) => tool.id === requestedToolId)
    : undefined;
  const selectedDemo = requestedDemoId
    ? catalog?.demos.find((demo) => demo.id === requestedDemoId)
    : undefined;

  const selectedCategory: Category | undefined = selectedTool && catalog
    ? catalog.categories.find((category) => category.id === selectedTool.categoryId)
    : undefined;
  const toolCategory: Category | undefined = selectedTool
    ? selectedCategory ?? {
        id: selectedTool.categoryId,
        name: '未分类',
        description: '',
        icon: '·',
      }
    : undefined;

  const relatedTools = useMemo(() => {
    if (!catalog || !selectedTool) return [];
    return catalog.tools
      .filter((tool) => tool.categoryId === selectedTool.categoryId && tool.id !== selectedTool.id)
      .slice(0, 3);
  }, [catalog, selectedTool]);

  const demoTools = useMemo(() => {
    if (!catalog || !selectedDemo) return [];
    return selectedDemo.toolIds
      .map((id) => catalog.tools.find((tool) => tool.id === id))
      .filter((tool): tool is Tool => Boolean(tool));
  }, [catalog, selectedDemo]);

  const activeCategory = filters.category;
  let sidebarActive: SidebarActive = 'none';
  if (pathname === '/') {
    if (filters.favorites) sidebarActive = 'favorites';
    else if (filters.featured) sidebarActive = 'featured';
    else if (filters.category) sidebarActive = 'category';
    else sidebarActive = 'all';
  } else if (pathname === '/demos' || pathname.startsWith('/demos/')) {
    sidebarActive = 'demos';
  }

  let contextLabel = '全部工具';
  if (pathname === '/') {
    if (filters.q) contextLabel = '搜索目录';
    else if (filters.favorites) contextLabel = '我的收藏';
    else if (filters.featured) contextLabel = '编辑精选';
    else if (selectedCategory) contextLabel = selectedCategory.name;
    else if (filters.category) {
      contextLabel = catalog?.categories.find((item) => item.id === filters.category)?.name ?? '分类';
    }
  } else if (pathname === '/demos') {
    contextLabel = '站内示例';
  } else if (selectedDemo) {
    contextLabel = selectedDemo.name;
  } else if (selectedTool) {
    contextLabel = selectedTool.name;
  } else if (pathname.startsWith('/tools/')) {
    contextLabel = '工具详情';
  } else if (pathname.startsWith('/demos/')) {
    contextLabel = '站内示例';
  } else if (pathname !== '/') {
    contextLabel = '没有找到';
  }

  let pageTitle = BASE_TITLE;
  let pageDescription = BASE_DESCRIPTION;
  if (catalog) {
    if (pathname === '/') {
      if (filters.q) {
        pageTitle = `搜索“${filters.q}” · Vibe 工具集`;
        pageDescription = `在 Vibe 工具集中搜索“${filters.q}”的结果。`;
      } else if (filters.category) {
        const name = catalog.categories.find((category) => category.id === filters.category)?.name;
        if (name) {
          pageTitle = `${name} · Vibe 工具集`;
          pageDescription = `浏览 Vibe 工具集中的${name}分类，按平台与授权筛选并收藏到本机。`;
        }
      } else if (filters.favorites) {
        pageTitle = '我的收藏 · Vibe 工具集';
        pageDescription = '保存在当前浏览器中的工具收藏，无需账号。';
      }
    } else if (pathname === '/demos') {
      pageTitle = '站内示例 · Vibe 工具集';
      pageDescription = '六个可直接操作的原理演示：弹簧参数、图表切换、渐变、看板、Canvas 粒子与安全 Markdown。';
    } else if (selectedDemo) {
      pageTitle = `${selectedDemo.name} · 站内示例 · Vibe 工具集`;
      pageDescription = selectedDemo.description;
    } else if (selectedTool) {
      pageTitle = `${selectedTool.name} · Vibe 工具集`;
      pageDescription = selectedTool.tagline;
    } else if (pathname.startsWith('/tools/') || pathname.startsWith('/demos/')) {
      pageTitle = '没有找到这项内容 · Vibe 工具集';
      pageDescription = '这项内容暂时不在目录中。';
    }
  }

  useEffect(() => {
    document.title = pageTitle;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.setAttribute('content', pageDescription);
  }, [pageDescription, pageTitle]);

  if (loadStatus === 'loading') return <LoadingScreen />;
  if (loadStatus === 'error' || !catalog) {
    return (
      <ErrorScreen
        message={errorMessage || '目录服务暂时没有回应，请稍后重试。'}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  const goHome = () => {
    setDrawerOpen(false);
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const goFeatured = () => {
    setDrawerOpen(false);
    navigate('/?featured=1');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const goFavorites = () => {
    setDrawerOpen(false);
    navigate('/?favorites=1');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const goDemos = () => {
    setDrawerOpen(false);
    navigate('/demos');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const goCategory = (id: string) => {
    setDrawerOpen(false);
    navigate(`/?category=${encodeURIComponent(id)}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const updatePlatform = (value: string) => {
    const next = new URLSearchParams(route.search);
    if (value) next.set('platform', value);
    else next.delete('platform');
    const query = next.toString();
    navigate(query ? `/?${query}` : '/');
  };
  const updatePricing = (value: string) => {
    const next = new URLSearchParams(route.search);
    if (value) next.set('pricing', value);
    else next.delete('pricing');
    const query = next.toString();
    navigate(query ? `/?${query}` : '/');
  };
  const clearFilters = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleSearchAll = (query: string) => {
    setSearchOpen(false);
    if (query.trim()) navigate(`/?q=${encodeURIComponent(query.trim())}`);
    else navigate('/');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const isLanding =
    pathname === '/' &&
    !filters.q &&
    !filters.category &&
    !filters.platform &&
    !filters.pricing &&
    !filters.favorites &&
    !filters.featured;

  let content;
  if (pathname === '/') {
    content = (
      <HomePage
        catalog={catalog}
        tools={visibleTools}
        filters={filters}
        isLanding={isLanding}
        favoriteSet={favoriteSet}
        searchSuffix={route.search}
        onToggleFavorite={handleToggleFavorite}
        onCopyInstall={handleCopyInstall}
        onPlatformChange={updatePlatform}
        onPricingChange={updatePricing}
        onClearFilters={clearFilters}
      />
    );
  } else if (pathname === '/demos') {
    content = <DemosPage demos={catalog.demos} />;
  } else if (demoMatch) {
    content = selectedDemo ? (
      <DemoPage demo={selectedDemo} tools={demoTools} onCopy={handleCopy} />
    ) : (
      <NotFoundPage
        title="没有找到这个示例"
        description="示例地址可能已经变化。回到站内示例页，看看其他可以动手的演示。"
        backHref="/demos"
        backLabel="回到站内示例"
      />
    );
  } else if (toolMatch) {
    content = selectedTool && toolCategory ? (
      <ToolPage
        tool={selectedTool}
        category={toolCategory}
        demo={catalog.demos.find((demo) => demo.id === selectedTool.demoId)}
        relatedTools={relatedTools}
        categories={catalog.categories}
        search={route.search}
        updatedAt={catalog.updatedAt}
        isFavorite={favoriteSet.has(selectedTool.id)}
        onToggleFavorite={handleToggleFavorite}
        onCopyInstall={handleCopyInstall}
      />
    ) : (
      <NotFoundPage
        title="这个工具暂时不在目录里"
        description="链接可能已经更新，或者这项工具还没有被收录。目录里还有其他选择。"
        backHref={route.search ? `/${route.search}` : '/'}
        backLabel="回到工具目录"
      />
    );
  } else {
    content = <NotFoundPage />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <aside className="sidebar" aria-label="分类导航">
        <Sidebar
          categories={catalog.categories}
          toolCounts={toolCounts}
          totalTools={catalog.tools.length}
          favoriteCount={favorites.ids.length}
          demoCount={catalog.demos.length}
          active={sidebarActive}
          activeCategory={activeCategory}
          onAll={goHome}
          onFeatured={goFeatured}
          onFavorites={goFavorites}
          onDemos={goDemos}
          onCategory={goCategory}
          onAbout={openAbout}
        />
      </aside>

      {drawerOpen ? (
        <div
          className="drawer-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="分类导航"
            ref={drawerRef}
            tabIndex={-1}
          >
            <Sidebar
              categories={catalog.categories}
              toolCounts={toolCounts}
              totalTools={catalog.tools.length}
              favoriteCount={favorites.ids.length}
              demoCount={catalog.demos.length}
              active={sidebarActive}
              activeCategory={activeCategory}
              onAll={goHome}
              onFeatured={goFeatured}
              onFavorites={goFavorites}
              onDemos={goDemos}
              onCategory={goCategory}
              onAbout={openAbout}
              onRequestClose={closeDrawer}
            />
          </aside>
        </div>
      ) : null}

      <div className="main-shell">
        <Topbar
          contextLabel={contextLabel}
          favoriteCount={favorites.ids.length}
          mode={theme.mode}
          resolvedTheme={theme.resolved}
          onOpenMenu={() => setDrawerOpen(true)}
          onOpenSearch={openSearch}
          setThemeMode={theme.setMode}
        />
        <main id="main-content" className="content" tabIndex={-1}>
          {content}
        </main>
        <Footer updatedAt={catalog.updatedAt} onAbout={openAbout} />
      </div>

      <SearchDialog
        open={searchOpen}
        tools={catalog.tools}
        categories={catalog.categories}
        onClose={closeSearch}
        onSelectTool={(tool) => {
          setSearchOpen(false);
          navigate(withCurrentSearch(`/tools/${encodeURIComponent(tool.id)}`, route.search));
        }}
        onSelectCategory={(category) => {
          setSearchOpen(false);
          navigate(`/?category=${encodeURIComponent(category.id)}`);
        }}
        onShowAll={handleSearchAll}
      />

      <AboutDialog
        open={aboutOpen}
        onClose={closeAbout}
        updatedAt={catalog.updatedAt}
        toolCount={catalog.tools.length}
        categoryCount={catalog.categories.length}
        demoCount={catalog.demos.length}
      />

      <Toast toast={toast} />
    </div>
  );
}
