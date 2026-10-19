import { Github, Heart, Menu, Search } from 'lucide-react';
import type { ThemeMode } from '../hooks/useTheme';
import { Brand } from './Brand';
import { ThemeMenu } from './ThemeMenu';

interface TopbarProps {
  contextLabel: string;
  favoriteCount: number;
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const IS_APPLE = /Mac|iPhone|iPad|iPod/.test(typeof navigator === 'undefined' ? '' : navigator.userAgent);

export function Topbar({
  contextLabel,
  favoriteCount,
  mode,
  resolvedTheme,
  onOpenMenu,
  onOpenSearch,
  setThemeMode,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__leading">
          <button
            type="button"
            className="icon-button topbar__menu"
            aria-label="打开分类导航"
            onClick={onOpenMenu}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="topbar__context">{contextLabel}</span>
          <a className="topbar__mobile-brand" href="/" aria-label="Vibe 工具集首页">
            <Brand compact />
          </a>
        </div>

        <button type="button" className="search-trigger" onClick={onOpenSearch} aria-label="打开搜索">
          <Search size={17} aria-hidden="true" />
          <span className="search-trigger__text">搜索工具、分类或关键词</span>
          <kbd>{IS_APPLE ? '⌘ K' : 'Ctrl K'}</kbd>
        </button>

        <div className="topbar__actions">
          <a
            className="icon-button topbar__favorite-link"
            href="/?favorites=1"
            aria-label={`我的收藏${favoriteCount ? `，${favoriteCount} 个` : ''}`}
            title="我的收藏"
          >
            <Heart size={18} aria-hidden="true" />
            <span className="topbar__favorite-label">收藏</span>
            {favoriteCount > 0 ? <span className="topbar__favorite-count">{favoriteCount}</span> : null}
          </a>
          <ThemeMenu mode={mode} resolved={resolvedTheme} setMode={setThemeMode} />
          <a className="icon-button topbar__github" href="https://github.com/Freakz2z/Vibe" target="_blank" rel="noopener noreferrer" aria-label="GitHub 开源仓库" title="GitHub 开源仓库"><Github size={19} aria-hidden="true" /></a>
        </div>
      </div>
    </header>
  );
}
