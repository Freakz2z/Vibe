import type { CSSProperties } from 'react';
import type { Category, Demo, Tool } from '../types';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Github,
  Heart,
  Sparkles,
  ExternalLink as ExternalIcon,
} from 'lucide-react';
import { formatUpdatedAt, platformLabels, pricingTones } from '../lib/catalog';
import { DemoThumb } from '../components/DemoThumb';

interface ToolPageProps {
  tool: Tool;
  category: Category;
  demo?: Demo;
  relatedTools: Tool[];
  categories: Category[];
  search: string;
  updatedAt: string;
  isFavorite: boolean;
  onToggleFavorite: (tool: Tool) => void;
  onCopyInstall: (tool: Tool) => void;
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function ToolPage({
  tool,
  category,
  demo,
  relatedTools,
  categories,
  search,
  updatedAt,
  isFavorite,
  onToggleFavorite,
  onCopyInstall,
}: ToolPageProps) {
  const backHref = search ? `/${search}` : '/';
  const categoryNames = new Map(categories.map((item) => [item.id, item.name]));

  return (
    <article
      className="page tool-page"
      style={{ '--tool-accent': tool.accent } as CSSProperties}
    >
      <nav className="breadcrumb" aria-label="面包屑导航">
        <a href={backHref}>
          <ArrowLeft size={14} aria-hidden="true" />
          返回目录
        </a>
        <span aria-hidden="true">/</span>
        <a href={`/?category=${category.id}`}>{category.name}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{tool.name}</span>
      </nav>

      <header className="tool-detail-hero">
        <div className="tool-detail-hero__icon tool-icon" aria-hidden="true">
          {tool.icon}
        </div>
        <div className="tool-detail-hero__body">
          <div className="tool-detail-hero__meta">
            <a href={`/?category=${category.id}`} className="category-pill">
              {category.icon} {category.name}
            </a>
            <span className={`price price--${pricingTones[tool.pricing]}`}>{tool.pricing}</span>
            {tool.featured ? (
              <span className="featured-pill">
                <Sparkles size={12} aria-hidden="true" />
                编辑精选
              </span>
            ) : null}
          </div>
          <h1>{tool.name}</h1>
          <p className="tool-detail-hero__tagline">{tool.tagline}</p>
          <p className="tool-detail-hero__description">{tool.description}</p>
          <div className="tool-detail-hero__actions">
            <a
              className="button button--primary"
              href={tool.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              访问官网
              <ExternalLink size={15} aria-hidden="true" />
            </a>
            {tool.github ? (
              <a
                className="button button--secondary"
                href={tool.github}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={15} aria-hidden="true" />
                GitHub
              </a>
            ) : null}
            <button
              type="button"
              className={`button button--quiet favorite-detail${isFavorite ? ' is-active' : ''}`}
              aria-pressed={isFavorite}
              onClick={() => onToggleFavorite(tool)}
            >
              <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
              {isFavorite ? '已收藏' : '收藏到本机'}
            </button>
          </div>
        </div>
      </header>

      <div className="tool-detail-grid">
        <div className="tool-detail-main">
          {demo ? (
            <section className="tool-demo-callout" aria-labelledby="tool-demo-title">
              <div className="tool-demo-callout__art">
                <DemoThumb kind={demo.kind} />
              </div>
              <div className="tool-demo-callout__body">
                <span className="principle-badge">原理演示</span>
                <h2 id="tool-demo-title">{demo.name}</h2>
                <p>{demo.description}</p>
                <a className="text-link" href={`/demos/${demo.id}`}>
                  打开站内示例
                  <ExternalIcon size={14} aria-hidden="true" />
                </a>
              </div>
            </section>
          ) : null}

          {tool.install ? (
            <section className="detail-section install-section" aria-labelledby="install-title">
              <div className="detail-section__heading">
                <div>
                  <p className="eyebrow">入手方式</p>
                  <h2 id="install-title">安装命令</h2>
                </div>
                <button
                  type="button"
                  className="copy-button"
                  onClick={() => onCopyInstall(tool)}
                >
                  <Copy size={14} aria-hidden="true" />
                  复制命令
                </button>
              </div>
              <pre className="install-command">
                <code>{tool.install}</code>
              </pre>
              <p className="detail-note">
                命令用于快速开始，具体版本与配置请以官方文档为准。复制成功或失败都会在本页给出提示。
              </p>
            </section>
          ) : (
            <section className="detail-section" aria-labelledby="start-title">
              <div className="detail-section__heading">
                <div>
                  <p className="eyebrow">入手方式</p>
                  <h2 id="start-title">从官网文档开始</h2>
                </div>
              </div>
              <p className="detail-paragraph">
                这个工具主要通过官方网站或应用使用。建议先按官方文档完成最小示例，再决定是否引入现有项目。
              </p>
            </section>
          )}

          <section className="detail-section" aria-labelledby="use-cases-title">
            <div className="detail-section__heading">
              <div>
                <p className="eyebrow">适用场景</p>
                <h2 id="use-cases-title">可以把它放在哪里</h2>
              </div>
            </div>
            <ul className="detail-list">
              {tool.useCases.map((item) => (
                <li key={item}>
                  <span className="detail-list__mark" aria-hidden="true">
                    <Check size={13} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="detail-section" aria-labelledby="highlights-title">
            <div className="detail-section__heading">
              <div>
                <p className="eyebrow">亮点</p>
                <h2 id="highlights-title">为什么值得了解</h2>
              </div>
            </div>
            <ul className="detail-list detail-list--highlights">
              {tool.highlights.map((item) => (
                <li key={item}>
                  <span className="detail-list__mark" aria-hidden="true">
                    <Sparkles size={13} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="tool-detail-aside" aria-label="工具速览">
          <div className="fact-card">
            <h2>速览</h2>
            <dl>
              <div>
                <dt>分类</dt>
                <dd>
                  <a href={`/?category=${category.id}`}>{category.name}</a>
                </dd>
              </div>
              <div>
                <dt>平台</dt>
                <dd>{tool.platforms.map((platform) => platformLabels[platform]).join(' · ')}</dd>
              </div>
              <div>
                <dt>授权</dt>
                <dd>{tool.pricing}</dd>
              </div>
              <div>
                <dt>收录更新</dt>
                <dd>{formatUpdatedAt(updatedAt)}</dd>
              </div>
              <div>
                <dt>官方站点</dt>
                <dd>
                  <a href={tool.website} target="_blank" rel="noopener noreferrer">
                    {displayHost(tool.website)}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </dd>
              </div>
              {tool.github ? (
                <div>
                  <dt>源码</dt>
                  <dd>
                    <a href={tool.github} target="_blank" rel="noopener noreferrer">
                      GitHub
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="fact-card__note">
              价格与许可可能调整，请以官方页面为准。收录不代表推荐，也未声称逐一实测。
            </p>
          </div>

          <div className="tag-panel">
            <h2>标签</h2>
            <div className="tool-card__tags">
              {tool.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {relatedTools.length > 0 ? (
        <section className="related-section" aria-labelledby="related-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">继续浏览</p>
              <h2 id="related-title">同一分类里的其他工具</h2>
            </div>
            <a className="text-link" href={`/?category=${category.id}`}>
              查看全部
              <ExternalIcon size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="related-list">
            {relatedTools.map((related) => (
              <a className="related-item" href={`/tools/${related.id}`} key={related.id}>
                <span
                  className="tool-icon tool-icon--small"
                  style={{ '--tool-accent': related.accent } as CSSProperties}
                  aria-hidden="true"
                >
                  {related.icon}
                </span>
                <span className="related-item__body">
                  <strong>{related.name}</strong>
                  <span>{related.tagline}</span>
                </span>
                <span className="related-item__meta">{categoryNames.get(related.categoryId) ?? ''}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
