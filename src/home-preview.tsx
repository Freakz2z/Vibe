import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { Catalog } from '../shared/contracts';
import { CatalogOverview } from '../apps/web/src/components/CatalogOverview';
import { Sidebar } from '../apps/web/src/components/Sidebar';
import { Topbar } from '../apps/web/src/components/Topbar';

import { ToolPage } from '../apps/web/src/pages/ToolPage';
import { DemosPage } from '../apps/web/src/pages/DemosPage';
import { DemoPageLayout } from '../apps/web/src/components/DemoPageLayout';
import { Footer } from '../apps/web/src/components/Footer';

const noop = () => {};

/** Readable first paint, using the actual UI components and the same D1 snapshot as boot data. */
export function renderHomePreview(catalog: Catalog, path = '/'): string {
  return renderPreview(catalog, path);
}

function renderPreview(catalog: Catalog, path: string): string {
  const counts = new Map(
    catalog.categories.map((category) => [
      category.id,
      catalog.tools.filter((tool) => tool.categoryId === category.id).length,
    ]),
  );
  const tool = catalog.tools.find(item => path === '/tools/' + encodeURIComponent(item.id));
  const demo = catalog.demos.find(item => path === '/demos/' + encodeURIComponent(item.id));
  let content: ReactNode;
  if (tool) {
    const category = catalog.categories.find(item => item.id === tool.categoryId)!;
    content = <ToolPage tool={tool} category={category} demo={catalog.demos.find(item => item.id === tool.demoId)}
      relatedTools={catalog.tools.filter(item => item.categoryId === tool.categoryId && item.id !== tool.id).slice(0, 3)}
      search="" updatedAt={catalog.updatedAt} isFavorite={false} onToggleFavorite={noop} onCopyInstall={noop} onBackToDirectory={noop} />;
  } else if (demo) {
    content = <DemoPageLayout demo={demo} tools={catalog.tools.filter(item => item.id === demo.stack)} onBackToDemos={noop}>
      <p className="detail-note" role="status">启用 JavaScript 后可操作此示例。</p>
    </DemoPageLayout>;
  } else if (path === '/demos') {
    content = <DemosPage demos={catalog.demos} tools={catalog.tools} />;
  } else {
    content = <div className="page page--home">
      <header className="browse-heading browse-heading--compact">
        <p className="eyebrow">网站概览</p><div className="browse-heading__title-row"><h1>首页</h1></div>
      </header>
      <CatalogOverview catalog={catalog} />
      <section id="directory" className="home-section directory-section" aria-labelledby="directory-title">
        <h2 id="directory-title" className="directory-title">工具目录</h2>
        <div className="home-preview-links">{catalog.tools.map(item => <a key={item.id} href={'/tools/' + encodeURIComponent(item.id)}>
          <strong>{item.name}</strong><span>{item.tagline}</span>
        </a>)}</div>
      </section>
    </div>;
  }
  return renderToString(
    <div className="app-shell" data-home-preview={path === '/' ? 'true' : undefined} data-page-preview={path}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className="sidebar" aria-label="分类导航">
        <Sidebar
          categories={catalog.categories}
          toolCounts={counts}
          demoCount={catalog.demos.length}
          active={path.startsWith('/demos') ? 'demos' : path === '/' ? 'all' : 'none'}
          activeCategory=""
          onAll={noop}
          onDemos={noop}
          onCategory={noop}
        />
      </aside>
      <div className="main-shell">
        <Topbar
          contextLabel={tool?.name || demo?.name || (path === '/demos' ? '站内示例' : '首页')}
          favoriteCount={0}
          mode="light"
          resolvedTheme="light"
          onOpenMenu={noop}
          onOpenSearch={noop}
          setThemeMode={noop}
        />
        <main id="main-content" className="content" tabIndex={-1}>
          {content}
        </main>
        <Footer updatedAt={catalog.updatedAt} />
      </div>
    </div>,
  );
}
