import { IS_TOY } from '../lib/runtime';
import { ToyOverview } from '../toy/Chrome';
import { Heart, Search } from 'lucide-react';
import type { Catalog, Tool } from '../types';
import type { ToolFilters } from '../lib/catalog';
import { filterTools, groupTools } from '../lib/catalog';
import { ToolCard } from '../components/ToolCard';
import { FilterBar, type ActiveFilter, type FilterKey } from '../components/FilterBar';
import { CatalogOverview } from '../components/CatalogOverview';
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
  onApplyFilters?: (platform: string, pricing: string) => void;
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
          {favorites ? '返回首页' : '清除所有筛选'}
        </button>
      </div>
    </div>
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
  onApplyFilters,
  onRemoveFilter,
  onClearAllFilters,
  onClearFavoriteFilters,
}: HomePageProps) {
  const categoryNames = new Map(catalog.categories.map((category) => [category.id, category.name]));
  const groups = groupTools(tools, catalog.categories);
  const activeCategory = catalog.categories.find((category) => category.id === filters.category);
  const hasFacetFilters = Boolean(filters.platform || filters.pricing);

  let heading = '首页';
  let headingDescription: string | undefined;
  let eyebrow = '网站概览';
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
        <header className="browse-heading browse-heading--compact">
          <p className="eyebrow">{eyebrow}</p>
          <div className="browse-heading__title-row">
            <h1>{heading}</h1>
            {!isLanding ? <span className="browse-heading__count" aria-live="polite">
              共 {tools.length} 个工具
            </span> : null}
          </div>
          {headingDescription ? <p>{headingDescription}</p> : null}
        </header>

      {isLanding ? IS_TOY ? <ToyOverview catalog={catalog} /> : <CatalogOverview catalog={catalog} /> : null}

      <section
        className={`home-section directory-section${isLanding ? '' : ' directory-section--results'}`}
        id="directory"
        aria-labelledby="directory-title"
      >
        <h2 id="directory-title" className={isLanding ? 'directory-title' : 'sr-only'}>工具目录</h2>

        <FilterBar
          platform={filters.platform}
          pricing={filters.pricing}
          activeFilters={activeFilters}
          resultCount={tools.length}
          onPlatformChange={onPlatformChange}
          onPricingChange={onPricingChange}
          onApply={onApplyFilters}
          previewCount={(platform, pricing) => filterTools(catalog.tools, catalog.categories, {...filters, platform, pricing}, favoriteSet).length}
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
