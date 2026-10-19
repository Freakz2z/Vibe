import { ArrowRight, ChevronDown, Heart, Search, Sparkles } from 'lucide-react';
import type { Catalog, Demo, Tool } from '../types';
import type { ToolFilters } from '../lib/catalog';
import { formatUpdatedAt, groupTools } from '../lib/catalog';
import { FeaturedToolCard, ToolCard } from '../components/ToolCard';
import { DemoCard } from '../components/DemoCard';
import { FilterBar } from '../components/FilterBar';

interface HomePageProps {
  catalog: Catalog;
  tools: Tool[];
  filters: ToolFilters;
  isLanding: boolean;
  favoriteSet: ReadonlySet<string>;
  searchSuffix: string;
  onToggleFavorite: (tool: Tool) => void;
  onCopyInstall: (tool: Tool) => void;
  onPlatformChange: (value: string) => void;
  onPricingChange: (value: string) => void;
  onClearFilters: () => void;
}

function EmptyDirectory({
  favorites,
  query,
  onClear,
}: {
  favorites: boolean;
  query: string;
  onClear: () => void;
}) {
  const title = favorites
    ? '这里还没有收藏'
    : query
      ? `没有找到“${query}”`
      : '这一组合暂时没有匹配';

  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {favorites ? <Heart size={24} /> : <Search size={24} />}
      </span>
      <h3>{title}</h3>
      <button type="button" className="button button--secondary" onClick={onClear}>
        清除所有筛选
      </button>
    </div>
  );
}

function FeaturedSection({ catalog, searchSuffix }: { catalog: Catalog; searchSuffix: string }) {
  const categoryNames = new Map(catalog.categories.map((category) => [category.id, category.name]));
  const featured = catalog.tools.filter((tool) => tool.featured).slice(0, 8);

  return (
    <section className="home-section featured-section" aria-label="编辑精选">
      <div className="section-heading">
        <div>
          <p className="eyebrow">编辑精选</p>
        </div>
        <a className="text-link" href="/?featured=1">
          只看精选
          <ArrowRight size={15} aria-hidden="true" />
        </a>
      </div>
      <div className="featured-grid">
        {featured.map((tool) => (
          <FeaturedToolCard
            key={tool.id}
            tool={tool}
            categoryName={categoryNames.get(tool.categoryId) ?? ''}
            hrefSuffix={searchSuffix}
          />
        ))}
      </div>
    </section>
  );
}

function DemoSection({ demos }: { demos: Demo[] }) {
  return (
    <section className="home-section demos-section" aria-label="站内示例">
      <div className="section-heading">
        <div>
          <p className="eyebrow">站内示例</p>
        </div>
        <a className="text-link" href="/demos">
          查看全部示例
          <ArrowRight size={15} aria-hidden="true" />
        </a>
      </div>
      <div className="demo-grid">
        {demos.map((demo) => (
          <DemoCard key={demo.id} demo={demo} />
        ))}
      </div>
    </section>
  );
}

export function HomePage({
  catalog,
  tools,
  filters,
  isLanding,
  favoriteSet,
  searchSuffix,
  onToggleFavorite,
  onCopyInstall,
  onPlatformChange,
  onPricingChange,
  onClearFilters,
}: HomePageProps) {
  const categoryNames = new Map(catalog.categories.map((category) => [category.id, category.name]));
  const groups = groupTools(tools, catalog.categories);
  const activeCategory = catalog.categories.find((category) => category.id === filters.category);
  const hasFilters = Boolean(
    filters.q || filters.category || filters.platform || filters.pricing || filters.favorites || filters.featured,
  );

  let heading = '完整目录';
  let headingDescription: string | undefined;
  if (filters.q) {
    heading = `搜索“${filters.q}”`;
  } else if (filters.favorites) {
    heading = '我的收藏';
  } else if (filters.featured) {
    heading = '编辑精选';
  } else if (activeCategory) {
    heading = activeCategory.name;
    headingDescription = activeCategory.description;
  }

  return (
    <div className="page page--home">
      {isLanding ? (
        <>
          <section className="hero" aria-label="目录概况">
            <div className="hero__texture" aria-hidden="true" />
            <div className="hero__content">
              <p className="eyebrow hero__eyebrow">
                <span className="eyebrow__dot" aria-hidden="true" />
                Vibe 工具集 · 独立开发者的中文工具导航
              </p>
              <div className="hero__actions">
                <a className="button button--primary" href="#directory">
                  开始浏览
                  <ChevronDown size={16} aria-hidden="true" />
                </a>
                <a className="button button--secondary" href="/demos">
                  试试站内示例
                  <Sparkles size={16} aria-hidden="true" />
                </a>
              </div>
              <dl className="hero__stats" aria-label="目录概况">
                <div>
                  <dt>件工具</dt>
                  <dd>{catalog.tools.length}</dd>
                </div>
                <div>
                  <dt>个分类</dt>
                  <dd>{catalog.categories.length}</dd>
                </div>
                <div>
                  <dt>个动手示例</dt>
                  <dd>{catalog.demos.length}</dd>
                </div>
                <div className="hero__updated">
                  <dt>最近整理</dt>
                  <dd>{formatUpdatedAt(catalog.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <FeaturedSection catalog={catalog} searchSuffix={searchSuffix} />
          <DemoSection demos={catalog.demos} />
        </>
      ) : (
        <header className="browse-heading browse-heading--compact">
          <p className="eyebrow">{filters.favorites ? '我的收藏' : filters.q ? '搜索结果' : '目录浏览'}</p>
          <div className="browse-heading__title-row">
            <h1>{heading}</h1>
            <span className="browse-heading__count">{tools.length} 个工具</span>
          </div>
          {headingDescription ? <p>{headingDescription}</p> : null}
        </header>
      )}

      <section
        className={`home-section directory-section${isLanding ? '' : ' directory-section--results'}`}
        id="directory"
        aria-labelledby="directory-title"
      >
        {isLanding ? (
          <div className="section-heading section-heading--directory">
            <div>
              <p className="eyebrow">目录</p>
              <h2 id="directory-title">按分类找工具</h2>
            </div>
          </div>
        ) : (
          <h2 id="directory-title" className="sr-only">
            筛选结果
          </h2>
        )}

        <FilterBar
          platform={filters.platform}
          pricing={filters.pricing}
          hasFilters={hasFilters}
          onPlatformChange={onPlatformChange}
          onPricingChange={onPricingChange}
          onClear={onClearFilters}
        />

        {tools.length === 0 ? (
          <EmptyDirectory favorites={filters.favorites} query={filters.q} onClear={onClearFilters} />
        ) : (
          <div className="tool-groups">
            {groups.map((group) => (
              <section className="tool-group" key={group.category.id} aria-labelledby={`group-${group.category.id}`}>
                <div className="tool-group__head">
                  <span className="tool-group__icon" aria-hidden="true">
                    {group.category.icon}
                  </span>
                  <div>
                    <h3 id={`group-${group.category.id}`}>{group.category.name}</h3>
                    {!filters.category ? <p>{group.category.description}</p> : null}
                  </div>
                  <span className="tool-group__count">{group.tools.length}</span>
                </div>
                <div className="tool-grid">
                  {group.tools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      categoryName={categoryNames.get(tool.categoryId) ?? ''}
                      hrefSuffix={searchSuffix}
                      isFavorite={favoriteSet.has(tool.id)}
                      onToggleFavorite={onToggleFavorite}
                      onCopyInstall={onCopyInstall}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
