import type { CSSProperties } from 'react';
import type { Category, Demo, Tool } from '../types';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Github,
  CodeXml,
  Heart,
  Sparkles,
} from 'lucide-react';
import { formatUpdatedAt, platformLabels, pricingTones } from '../lib/catalog';
import { DemoThumb } from '../components/LabThumb';
import { CategoryIcon, DemoStackIcon } from '../components/icons';
import { ToolLogo } from '../components/ToolLogo';

interface ToolPageProps {
  tool: Tool;
  category: Category;
  demo?: Demo;
  relatedTools: Tool[];
  search: string;
  updatedAt: string;
  isFavorite: boolean;
  onToggleFavorite: (tool: Tool) => void;
  onCopyInstall: (tool: Tool) => void;
  onBackToDirectory: (fallback: string) => void;
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
  updatedAt,
  isFavorite,
  onToggleFavorite,
  onCopyInstall,
  onBackToDirectory,
  search,
}: ToolPageProps) {
  const backHref = search ? `/${search}` : '/';
  const sourceUrl = tool.source || tool.github;
  const sourceLabel = sourceUrl?.startsWith('https://github.com/') ? 'GitHub' : '源码';

  return (
    <article
      className="page tool-page"
      style={{ '--tool-accent': tool.accent } as CSSProperties}
    >
      <nav className="breadcrumb" aria-label="面包屑导航">
        <a
          href={backHref}
          onClick={(event) => {
            event.preventDefault();
            onBackToDirectory(backHref);
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回目录
        </a>
        <span aria-hidden="true">/</span>
        <a href={`/?category=${category.id}`}>{category.name}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{tool.name}</span>
      </nav>

      <header className="tool-detail-hero">
        <ToolLogo tool={tool} className="tool-detail-hero__icon" />
        <div className="tool-detail-hero__body">
          <div className="tool-detail-hero__meta">
            <a href={`/?category=${category.id}`} className="category-pill">
              <CategoryIcon id={category.id} size={13} />
              {category.name}
            </a>

          </div>
          <h1>{tool.name}</h1>
          <p className="tool-detail-hero__tagline">{tool.tagline}</p>
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
            {sourceUrl ? (
              <a
                className="button button--secondary"
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {sourceLabel === 'GitHub' ? <Github size={15} aria-hidden="true" /> : <CodeXml size={15} aria-hidden="true" />}
                {sourceLabel}
              </a>
            ) : null}
            <button
              type="button"
              className={`button button--quiet favorite-detail${isFavorite ? ' is-active' : ''}`}
              aria-pressed={isFavorite}
              onClick={() => onToggleFavorite(tool)}
            >
              <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
              {isFavorite ? '已收藏' : '收藏'}
            </button>
          </div>
        </div>
      </header>

      <div className="tool-detail-grid">
        <div className="tool-detail-main">
          <section className="detail-section detail-section--intro" aria-labelledby="intro-title">
            <h2 id="intro-title">简介</h2>
            <p className="detail-prose">{tool.description}</p>
          </section>

          {tool.install ? (
            <section className="detail-section" aria-labelledby="install-title">
              <div className="detail-section__heading">
                <h2 id="install-title">安装</h2>
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
                命令用于快速开始，具体版本与配置请以官方文档为准。
              </p>
            </section>
          ) : null}

          <section className="detail-section" aria-labelledby="use-cases-title">
            <h2 id="use-cases-title">适用场景</h2>
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
            <h2 id="highlights-title">特点</h2>
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

          {demo ? (
            <section className="detail-section detail-section--demo" aria-labelledby="demo-title">
              <h2 id="demo-title">专属示例</h2>
              <div className="tool-demo-callout">
                <div className="tool-demo-callout__art">
                  <DemoThumb stack={demo.stack} />
                </div>
                <div className="tool-demo-callout__body">
                  <span className="principle-badge">
                    <DemoStackIcon stack={demo.stack} size={12} />
                    {demo.kind === 'service' ? '本站真实服务' : '真实运行'}
                  </span>
                  <h3>{demo.name}</h3>
                  <p>{demo.description}</p>
                  <a className="text-link" href={`/demos/${demo.id}`}>
                    打开示例
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="tool-detail-aside" aria-label="工具资料">
          <section className="fact-card" aria-labelledby="resources-title">
            <h2 id="resources-title">资料</h2>
            <dl>
              <div>
                <dt>平台</dt>
                <dd>{tool.platforms.map((platform) => platformLabels[platform]).join(' · ')}</dd>
              </div>
              <div>
                <dt>费用</dt>
                <dd>
                  <span className={`price price--${pricingTones[tool.pricing]}`}>{tool.pricing}</span>
                </dd>
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
              {sourceUrl ? (
                <div>
                  <dt>源码</dt>
                  <dd>
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                      {sourceLabel}
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            {tool.tags.length > 0 ? (
              <div className="fact-card__tags">
                <h3>标签</h3>
                <div className="tool-card__tags">
                  {tool.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="fact-card__note">
              价格与许可可能调整，请以官方页面为准。收录不代表推荐，也未声称逐一实测。
            </p>
          </section>
        </aside>
      </div>

      {relatedTools.length > 0 ? (
        <section className="related-section" aria-labelledby="related-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">继续浏览</p>
              <h2 id="related-title">相关工具</h2>
            </div>
            <a className="text-link" href={`/?category=${category.id}`}>
              查看全部
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="related-list">
            {relatedTools.map((related) => (
              <a
                className="related-item"
                href={`/tools/${related.id}${search}`}
                key={related.id}
              >
                <ToolLogo tool={related} className="tool-icon--small" />
                <span className="related-item__body">
                  <strong>{related.name}</strong>
                  <span>{related.tagline}</span>
                </span>
                <ArrowUpRight className="related-item__arrow" size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
