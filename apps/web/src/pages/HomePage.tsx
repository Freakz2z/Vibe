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

  const description = favorites
    ? '在任意工具卡片或详情页点一下心形按钮，工具就会留在这台设备上。'
    : query
      ? '试试更短的关键词、换一个分类，或清除筛选重新看看。'
      : '放宽平台或授权条件，通常就能找到可用的选择。';

  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {favorites ? <Heart size={24} /> : <Search size={24} />}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
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
    <section className="home-section featured-section" aria-labelledby="featured-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">编辑精选</p>
          <h2 id="featured-title">先从这里看</h2>
          <p className="section-heading__description">
            覆盖不同环节的八个起点。不是榜单，只是我们愿意先递给你的选择。
          </p>
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
      <div className="featured-actions">
        <span>
          <Sparkles size={14} aria-hidden="true" />
          精选会随目录整理调整
        </span>
        <details className="featured-details">
          <summary>
            精选怎么用
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <p>
            把它们当作了解目录的入口，不必照单全收。收藏功能可以把感兴趣的几项先放在本机，等真正需要时再比较。
          </p>
        </details>
      </div>
    </section>
  );
}

function DemoSection({ demos }: { demos: Demo[] }) {
  return (
    <section className="home-section demos-section" aria-labelledby="demos-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">站内示例</p>
          <h2 id="demos-title">先动手，再决定</h2>
          <p className="section-heading__description">
            六个可以直接操作的小实验，用来说明工具形态与交互原理。均由本站独立实现。
          </p>
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
  let headingDescription = '按分类铺开的选择。可以继续用平台与授权条件缩小范围。';
  if (filters.q) {
    heading = `搜索“${filters.q}”`;
    headingDescription = '关键词会同时匹配名称、简介、标签与适用场景。';
  } else if (filters.favorites) {
    heading = '我的收藏';
    headingDescription = '这些工具只保存在当前浏览器，不需要账号，也不会同步到云端。';
  } else if (filters.featured) {
    heading = '编辑精选';
    headingDescription = '八个覆盖不同环节的起点，可以继续按平台和授权筛选。';
  } else if (activeCategory) {
    heading = activeCategory.name;
    headingDescription = activeCategory.description;
  }

  return (
    <div className="page page--home">
      {isLanding ? (
        <>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero__texture" aria-hidden="true" />
            <div className="hero__content">
              <p className="eyebrow hero__eyebrow">
                <span className="eyebrow__dot" aria-hidden="true" />
                Vibe 工具集 · 独立开发者的中文工具导航
              </p>
              <h1 id="hero-title">
                把对味的工具，
                <br />
                放进同一条<span className="hero__accent">工作流</span>。
              </h1>
              <p className="hero__lede">
                从 AI 编程到移动开发，从动画到部署。按分类、平台和授权找到顺手的工具，再收进自己的短名单。
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
              <p className="hero__note">
                <Heart size={13} aria-hidden="true" />
                收藏只写入本机浏览器，无需登录。
              </p>
            </div>
          </section>

          <FeaturedSection catalog={catalog} searchSuffix={searchSuffix} />
          <DemoSection demos={catalog.demos} />
        </>
      ) : (
        <header className="browse-heading browse-heading--compact">
          <p className="eyebrow">{filters.favorites ? '本机短名单' : filters.q ? '搜索结果' : '目录浏览'}</p>
          <div className="browse-heading__title-row">
            <h1>{heading}</h1>
            <span className="browse-heading__count">{tools.length} 个工具</span>
          </div>
          <p>{headingDescription}</p>
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
            <p className="result-note">平台与授权条件会即时筛选下方结果</p>
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
