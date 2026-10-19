import { renderToString } from 'react-dom/server';
import type { Catalog } from '../shared/contracts';
import { CatalogOverview } from '../apps/web/src/components/CatalogOverview';
import { Sidebar } from '../apps/web/src/components/Sidebar';
import { Topbar } from '../apps/web/src/components/Topbar';

const noop = () => {};

/** Readable first paint, using the actual UI components and the same D1 snapshot as boot data. */
export function renderHomePreview(catalog: Catalog): string {
  const counts = new Map(
    catalog.categories.map((category) => [
      category.id,
      catalog.tools.filter((tool) => tool.categoryId === category.id).length,
    ]),
  );
  return renderToString(
    <div className="app-shell" data-home-preview="true">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className="sidebar" aria-label="分类导航">
        <Sidebar
          categories={catalog.categories}
          toolCounts={counts}
          demoCount={catalog.demos.length}
          active="all"
          activeCategory=""
          onAll={noop}
          onDemos={noop}
          onCategory={noop}
        />
      </aside>
      <div className="main-shell">
        <Topbar
          contextLabel="首页"
          favoriteCount={0}
          mode="light"
          resolvedTheme="light"
          onOpenMenu={noop}
          onOpenSearch={noop}
          setThemeMode={noop}
        />
        <main id="main-content" className="content" tabIndex={-1}>
          <div className="page page--home">
            <header className="browse-heading browse-heading--compact">
              <p className="eyebrow">网站概览</p>
              <div className="browse-heading__title-row">
                <h1>首页</h1>
              </div>
            </header>
            <CatalogOverview catalog={catalog} />
            <section id="directory" className="home-section directory-section" aria-labelledby="directory-title">
              <h2 id="directory-title" className="directory-title">工具目录</h2>
              <div className="home-preview-directory" role="status" aria-label="正在加载工具目录">
                <span /><span /><span />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>,
  );
}
