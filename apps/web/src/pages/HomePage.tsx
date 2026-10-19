import { ArrowRight, ChevronDown, Heart, Search, Sparkles } from 'lucide-react';
import type { Catalog, Demo, Tool } from '../types';
import type { ToolFilters } from '../lib/catalog';
import { formatUpdatedAt, groupTools } from '../lib/catalog';
import { FeaturedToolCard, ToolCard } from '../components/ToolCard';
import { DemoCard } from '../components/DemoCard';
import { FilterBar, type ActiveFilter, type FilterKey } from '../components/FilterBar';
import { CategoryIcon } from '../components/icons';

interface HomePageProps {
  catalog: Catalog;
  tools: Tool[];
  filters: ToolFilters;
  isLanding: boolean;
  favoriteSet: ReadonlySet<string>;
  searchSuffix: string;
  activeFilters: ActiveFilter[];
  onToggleFavorite: (tool: Tool) => void;
  onCopyInstall: (tool: Tool) => void;
  onPlatformChange: (value: string) => void;
  onPricingChange: (value: string) => void;
  onRemoveFilter: (key: FilterKey) => void;
  onClearAllFilters: () => void;
  onClearFavoriteFilters: () => void;
}

function EmptyDirectory({
  favorites,
  query,
  hasOtherFilters,
  onClearAll,
  onClearFavoriteFilters,
}: {
  favorites: boolean;
  query: string;
  hasOtherFilters: boolean;
  onClearAll: () => void;
  onClearFavoriteFilters: () => void;
}) {
  let title = '没有符合条件的工具';
  if (favorites) {
    title = hasOtherFilters ? '收藏中没有符合筛选条件的工具' : '这里还没有收藏';
  } else if (query) {
    title = `没有找到“${query}”`;
  }

  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {favorites ? <Heart size={24} /> : <Search size={24} />}
      </span>
      <h3>{title}</h3>
      <div className="empty-state__actions">
        {favorites && hasOtherFilters ? (
          <button type="button" className="button button--primary" onClick={onClearFavoriteFilters}>
            清除筛选，查看全部收藏
          </button>
        ) : null}
        <button
          type="button"
          className={`button ${favorites && hasOtherFilters ? 'button--quiet' : 'button--secondary'}`}
          onClick={onClearAll}
        >
          {favorites ? '浏览全部工具' : '清除所有筛选'}
        </button>
      </div>
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
  activeFilters,
  onToggleFavorite,
  onCopyInstall,
  onPlatformChange,
  onPricingChange,
  onRemoveFilter,
  onClearAllFilters,
  onClearFavoriteFilters,
}: HomePageProps) {
  const categoryNames = new Map(catalog.categories.map((category) => [category.id, category.name]));
  const groups = groupTools(tools, catalog.categories);
  const activeCategory = catalog.categories.find((category) => category.id === filters.category);
  const hasFacetFilters = Boolean(filters.platform || filters.pricing);

  let heading = '完整目录';
  let headingDescription: string | undefined;
  let eyebrow = '目录浏览';
  if (filters.q) {
    heading = `搜索“${filters.q}”`;
    eyebrow = '搜索结果';
  } else if (filters.favorites) {
    heading = '我的收藏';
    eyebrow = '收藏';
  } else if (activeCategory) {
    heading = activeCategory.name;
    headingDescription = activeCategory.description;
    eyebrow = '分类浏览';
  } else if (hasFacetFilters) {
    heading = '筛选结果';
    eyebrow = '目录浏览';
  }

  const favoriteFilterCount = activeFilters.filter((filter) => filter.key !== 'favorites').length;

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
          <p className="eyebrow">{eyebrow}</p>
          <div className="browse-heading__title-row">
            <h1>{heading}</h1>
            <span className="browse-heading__count" aria-live="polite">
              共 {tools.length} 个工具
            </span>
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
          activeFilters={activeFilters}
          resultCount={tools.length}
          onPlatformChange={onPlatformChange}
          onPricingChange={onPricingChange}
          onRemoveFilter={onRemoveFilter}
          onClearAll={onClearAllFilters}
        />

        {tools.length === 0 ? (
          <EmptyDirectory
            favorites={filters.favorites}
            query={filters.q}
            hasOtherFilters={filters.favorites && favoriteFilterCount > 0}
            onClearAll={onClearAllFilters}
            onClearFavoriteFilters={onClearFavoriteFilters}
          />
        ) : (
          <div className="tool-groups">
            {groups.map((group) => (
              <section className="tool-group" key={group.category.id} aria-labelledby={`group-${group.category.id}`}>
                <div className="tool-group__head">
                  <span className="tool-group__icon" aria-hidden="true">
                    <CategoryIcon id={group.category.id} size={15} />
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
