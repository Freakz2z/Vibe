import { Compass, Heart, Info, Sparkles, X } from 'lucide-react';
import type { Category } from '../types';
import { Brand } from './Brand';

export type SidebarActive = 'all' | 'featured' | 'favorites' | 'demos' | 'category' | 'none';

interface SidebarProps {
  categories: Category[];
  toolCounts: Map<string, number>;
  totalTools: number;
  favoriteCount: number;
  demoCount: number;
  active: SidebarActive;
  activeCategory: string;
  onAll: () => void;
  onFeatured: () => void;
  onFavorites: () => void;
  onDemos: () => void;
  onCategory: (id: string) => void;
  onAbout: () => void;
  onRequestClose?: () => void;
}

const BUILDING_GROUPS = ['ai-coding', 'frontend-ui', 'motion', 'charts', 'backend', 'devops', 'mobile'];
const MAKING_GROUPS = ['design', 'content', 'productivity'];

export function Sidebar({
  categories,
  toolCounts,
  totalTools,
  favoriteCount,
  demoCount,
  active,
  activeCategory,
  onAll,
  onFeatured,
  onFavorites,
  onDemos,
  onCategory,
  onAbout,
  onRequestClose,
}: SidebarProps) {
  const building = categories.filter((category) => BUILDING_GROUPS.includes(category.id));
  const making = categories.filter((category) => MAKING_GROUPS.includes(category.id));

  return (
    <div className="sidebar__inner">
      <div className="sidebar__top">
        <a className="sidebar__brand-link" href="/" aria-label="Vibe 工具集首页" onClick={onRequestClose}>
          <Brand />
        </a>
        {onRequestClose ? (
          <button
            type="button"
            className="icon-button sidebar__close"
            aria-label="关闭分类导航"
            onClick={onRequestClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav className="sidebar__nav" aria-label="主导航">
        <div className="sidebar__section">
          <p className="sidebar__label">发现</p>
          <button
            type="button"
            className={`sidebar__item${active === 'all' ? ' is-active' : ''}`}
            onClick={onAll}
            aria-current={active === 'all' ? 'page' : undefined}
          >
            <Compass size={16} aria-hidden="true" />
            <span>全部工具</span>
            <span className="sidebar__count">{totalTools}</span>
          </button>
          <button
            type="button"
            className={`sidebar__item${active === 'featured' ? ' is-active' : ''}`}
            onClick={onFeatured}
            aria-current={active === 'featured' ? 'page' : undefined}
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>编辑精选</span>
          </button>
          <button
            type="button"
            className={`sidebar__item${active === 'favorites' ? ' is-active' : ''}`}
            onClick={onFavorites}
            aria-current={active === 'favorites' ? 'page' : undefined}
          >
            <Heart size={16} aria-hidden="true" />
            <span>我的收藏</span>
            <span className="sidebar__count">{favoriteCount}</span>
          </button>
          <button
            type="button"
            className={`sidebar__item${active === 'demos' ? ' is-active' : ''}`}
            onClick={onDemos}
            aria-current={active === 'demos' ? 'page' : undefined}
          >
            <span className="sidebar__demo-icon" aria-hidden="true">
              ◉
            </span>
            <span>站内示例</span>
            <span className="sidebar__count">{demoCount}</span>
          </button>
        </div>

        <div className="sidebar__section">
          <p className="sidebar__label">构建与交付</p>
          {building.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`sidebar__item sidebar__item--category${
                active === 'category' && activeCategory === category.id ? ' is-active' : ''
              }`}
              onClick={() => onCategory(category.id)}
              aria-current={active === 'category' && activeCategory === category.id ? 'page' : undefined}
            >
              <span className="sidebar__category-icon" aria-hidden="true">
                {category.icon}
              </span>
              <span>{category.name}</span>
              <span className="sidebar__count">{toolCounts.get(category.id) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="sidebar__section">
          <p className="sidebar__label">表达与整理</p>
          {making.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`sidebar__item sidebar__item--category${
                active === 'category' && activeCategory === category.id ? ' is-active' : ''
              }`}
              onClick={() => onCategory(category.id)}
              aria-current={active === 'category' && activeCategory === category.id ? 'page' : undefined}
            >
              <span className="sidebar__category-icon" aria-hidden="true">
                {category.icon}
              </span>
              <span>{category.name}</span>
              <span className="sidebar__count">{toolCounts.get(category.id) ?? 0}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="sidebar__foot">
        <p className="sidebar__local-note">
          <Heart size={13} aria-hidden="true" />
          收藏保存在本机，无需登录
        </p>
        <button type="button" className="sidebar__about" onClick={onAbout}>
          <Info size={15} aria-hidden="true" />
          关于与选型说明
        </button>
      </div>
    </div>
  );
}
