import { routeHref } from '../lib/runtime';
import { House, X } from 'lucide-react';
import type { Category } from '../types';
import { Brand } from './Brand';
import { CategoryIcon, DemoEntryIcon } from './icons';

export type SidebarActive = 'all' | 'demos' | 'category' | 'none';

interface SidebarProps {
  categories: Category[];
  toolCounts: Map<string, number>;
  demoCount: number;
  active: SidebarActive;
  activeCategory: string;
  onAll: () => void;
  onDemos: () => void;
  onCategory: (id: string) => void;
  onRequestClose?: () => void;
}

const BUILDING_GROUPS = ['ai-coding', 'frontend-ui', 'motion', 'charts', 'backend', 'devops', 'mobile'];
const MAKING_GROUPS = ['design', 'content', 'productivity'];

export function Sidebar({
  categories,
  toolCounts,
  demoCount,
  active,
  activeCategory,
  onAll,
  onDemos,
  onCategory,
  onRequestClose,
}: SidebarProps) {
  const building = categories.filter((category) => BUILDING_GROUPS.includes(category.id));
  const making = categories.filter((category) => MAKING_GROUPS.includes(category.id));

  return (
    <div className="sidebar__inner">
      <div className="sidebar__top">
        <a className="sidebar__brand-link" href={routeHref('/')} aria-label="Vibe 工具集首页" onClick={onRequestClose}>
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
            <House size={16} aria-hidden="true" />
            <span>首页</span>
          </button>
          <button
            type="button"
            className={`sidebar__item${active === 'demos' ? ' is-active' : ''}`}
            onClick={onDemos}
            aria-current={active === 'demos' ? 'page' : undefined}
          >
            <DemoEntryIcon size={16} />
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
                <CategoryIcon id={category.id} size={15} />
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
                <CategoryIcon id={category.id} size={15} />
              </span>
              <span>{category.name}</span>
              <span className="sidebar__count">{toolCounts.get(category.id) ?? 0}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
