import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Database,
  FlaskConical,
  Layers3,
} from 'lucide-react';
import type { Catalog, Tool } from '../types';
import { formatUpdatedAt, platformLabels, pricingLabels } from '../lib/catalog';
import { CategoryIcon } from './icons';

/** Counts reflect the complete published catalog, independently of directory filters. */
export function CatalogOverview({ catalog }: { catalog: Catalog }) {
  const categories = catalog.categories.map((category) => {
    const tools = catalog.tools.filter((tool) => tool.categoryId === category.id);
    const ids = new Set(tools.map((tool) => tool.id));
    return {
      category,
      tools: tools.length,
      demos: catalog.demos.filter((demo) => ids.has(demo.stack)).length,
    };
  });
  const pricing = (Object.keys(pricingLabels) as Tool['pricing'][]).map((label) => ({
    label,
    count: catalog.tools.filter((tool) => tool.pricing === label).length,
  }));
  const platforms = (Object.keys(platformLabels) as Tool['platforms'][number][]).map((value) => ({
    value,
    count: catalog.tools.filter((tool) => tool.platforms.includes(value)).length,
  }));

  return (
    <section className="catalog-overview" aria-label="网站数据">
      <dl className="catalog-metrics">
        <div>
          <dt>
            <Database size={16} aria-hidden="true" />
            收录工具
          </dt>
          <dd>
            {catalog.tools.length}
            <span>个</span>
          </dd>
        </div>
        <div>
          <dt>
            <FlaskConical size={16} aria-hidden="true" />
            可运行示例
          </dt>
          <dd>
            <a href="/demos" aria-label={`浏览 ${catalog.demos.length} 个站内示例`}>
              {catalog.demos.length}
              <span>个</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </dd>
        </div>
        <div>
          <dt>
            <Layers3 size={16} aria-hidden="true" />
            工具分类
          </dt>
          <dd>
            {catalog.categories.length}
            <span>类</span>
          </dd>
        </div>
        <div>
          <dt>
            <CalendarDays size={16} aria-hidden="true" />
            最新更新
          </dt>
          <dd className="catalog-metrics__date">
            <time dateTime={catalog.updatedAt}>{formatUpdatedAt(catalog.updatedAt)}</time>
          </dd>
        </div>
      </dl>

      <div className="catalog-breakdown">
        <section className="catalog-panel" aria-labelledby="category-stats-title">
          <div className="catalog-panel__head">
            <h2 id="category-stats-title">分类收录</h2>
            <a href="#directory">
              浏览工具
              <ArrowDown size={14} aria-hidden="true" />
            </a>
          </div>
          <table className="catalog-table">
            <caption className="sr-only">各分类的工具与示例数量</caption>
            <thead>
              <tr>
                <th scope="col">分类</th>
                <th scope="col">工具</th>
                <th scope="col">示例</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(({ category, tools, demos }) => (
                <tr key={category.id}>
                  <th scope="row">
                    <a href={`/?category=${encodeURIComponent(category.id)}`}>
                      <CategoryIcon id={category.id} size={15} />
                      <span>{category.name}</span>
                    </a>
                  </th>
                  <td>{tools}</td>
                  <td>{demos}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">合计</th>
                <td>{catalog.tools.length}</td>
                <td>{catalog.demos.length}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <div className="catalog-breakdown__side">
          <section className="catalog-panel" aria-labelledby="pricing-stats-title">
            <div className="catalog-panel__head">
              <h2 id="pricing-stats-title">授权方式</h2>
            </div>
            <ul className="catalog-distribution">
              {pricing.map(({ label, count }) => (
                <li key={label}>
                  <a href={`/?pricing=${encodeURIComponent(label)}`}>
                    <span>{label}</span>
                    <span className="catalog-distribution__track" aria-hidden="true">
                      <span
                        style={{
                          width: `${catalog.tools.length ? (count / catalog.tools.length) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <strong>{count}</strong>
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section className="catalog-panel" aria-labelledby="platform-stats-title">
            <div className="catalog-panel__head">
              <h2 id="platform-stats-title">支持平台</h2>
              <span>含多平台工具</span>
            </div>
            <ul className="catalog-platforms">
              {platforms.map(({ value, count }) => (
                <li key={value}>
                  <a href={`/?platform=${value}`}>
                    <span>{platformLabels[value]}</span>
                    <strong>{count}</strong>
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
