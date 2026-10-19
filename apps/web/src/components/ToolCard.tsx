import type { CSSProperties } from 'react';
import { ArrowUpRight, Copy, Heart, Sparkles } from 'lucide-react';
import type { Tool } from '../types';
import { pricingTones, shortPlatformLabels } from '../lib/catalog';

interface ToolCardProps {
  tool: Tool;
  categoryName: string;
  hrefSuffix?: string;
  isFavorite: boolean;
  onToggleFavorite: (tool: Tool) => void;
  onCopyInstall: (tool: Tool) => void;
}

export function ToolCard({
  tool,
  categoryName,
  hrefSuffix = '',
  isFavorite,
  onToggleFavorite,
  onCopyInstall,
}: ToolCardProps) {
  const titleId = `tool-${tool.id}-title`;

  return (
    <article
      className={`tool-card${tool.featured ? ' tool-card--featured' : ''}`}
      style={{ '--tool-accent': tool.accent } as CSSProperties}
    >
      <a
        className="tool-card__hit"
        href={`/tools/${tool.id}${hrefSuffix}`}
        aria-labelledby={titleId}
      >
        <span className="sr-only">查看详情</span>
      </a>

      <div className="tool-card__top">
        <span className="tool-icon" aria-hidden="true">
          {tool.icon}
        </span>
        <div className="tool-card__title-wrap">
          <div className="tool-card__title-row">
            <h3 id={titleId}>{tool.name}</h3>
            {tool.featured ? (
              <span className="feature-spark" title="编辑精选" aria-label="编辑精选">
                <Sparkles size={12} aria-hidden="true" />
              </span>
            ) : null}
          </div>
          <p className="tool-card__category">{categoryName}</p>
        </div>
        <button
          type="button"
          className={`favorite-button${isFavorite ? ' is-active' : ''}`}
          aria-label={isFavorite ? `取消收藏 ${tool.name}` : `收藏 ${tool.name}`}
          aria-pressed={isFavorite}
          onClick={() => onToggleFavorite(tool)}
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>

      <p className="tool-card__tagline">{tool.tagline}</p>

      <div className="tool-card__tags" aria-label="标签">
        {tool.tags.slice(0, 2).map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
        {tool.demoId ? <span className="tag tag--demo">可体验</span> : null}
      </div>

      <div className="tool-card__meta">
        <span className={`price price--${pricingTones[tool.pricing]}`}>{tool.pricing}</span>
        <span className="platform-list">
          {tool.platforms.map((platform) => (
            <span className="platform" key={platform}>
              {shortPlatformLabels[platform]}
            </span>
          ))}
        </span>
        {tool.install ? (
          <button
            type="button"
            className="quick-copy"
            onClick={() => onCopyInstall(tool)}
            aria-label={`复制 ${tool.name} 的安装命令`}
            title={tool.install}
          >
            <Copy size={12} aria-hidden="true" />
            安装
          </button>
        ) : (
          <span className="quick-detail" aria-hidden="true">
            详情
            <ArrowUpRight size={12} />
          </span>
        )}
      </div>
    </article>
  );
}

interface FeaturedToolCardProps {
  tool: Tool;
  categoryName: string;
  hrefSuffix?: string;
}

export function FeaturedToolCard({ tool, categoryName, hrefSuffix = '' }: FeaturedToolCardProps) {
  return (
    <a
      className="featured-tool"
      href={`/tools/${tool.id}${hrefSuffix}`}
      style={{ '--tool-accent': tool.accent } as CSSProperties}
    >
      <div className="featured-tool__top">
        <span className="tool-icon tool-icon--small" aria-hidden="true">
          {tool.icon}
        </span>
        <span className="featured-tool__category">{categoryName}</span>
        <ArrowUpRight className="featured-tool__arrow" size={15} aria-hidden="true" />
      </div>
      <h3>{tool.name}</h3>
      <p>{tool.tagline}</p>
    </a>
  );
}
