import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import type { Category, Tool } from '../types';
import { useDialog } from '../hooks/useDialog';
import { usePresence } from '../hooks/usePresence';
import { toolMatches } from '../lib/catalog';
import { CategoryIcon } from './icons';
import { ToolLogo } from './ToolLogo';

interface SearchDialogProps {
  open: boolean;
  tools: Tool[];
  categories: Category[];
  onClose: () => void;
  onSelectTool: (tool: Tool) => void;
  onSelectCategory: (category: Category) => void;
  onShowAll: (query: string) => void;
}

function searchScore(tool: Tool, query: string): number {
  const normalized = query.trim().toLocaleLowerCase();
  const name = tool.name.toLocaleLowerCase();
  if (!normalized) return 0;
  if (name === normalized) return 5;
  if (name.startsWith(normalized)) return 4;
  if (name.includes(normalized)) return 3;
  if (tool.tags.some((tag) => tag.toLocaleLowerCase().includes(normalized))) return 2;
  return 1;
}

export function SearchDialog({
  open,
  tools,
  categories,
  onClose,
  onSelectTool,
  onSelectCategory,
  onShowAll,
}: SearchDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const presence = usePresence(open);

  useDialog(open, dialogRef, onClose, inputRef);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
  }, [open]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const results = useMemo(() => {
    const normalized = query.trim();
    const pool = normalized
      ? tools
          .filter((tool) => toolMatches(tool, normalized, categoryNames.get(tool.categoryId)))
          .slice()
          .sort((a, b) => searchScore(b, normalized) - searchScore(a, normalized))
      : tools.filter((tool) => tool.featured);

    return pool.slice(0, 8);
  }, [categoryNames, query, tools]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(results.length - 1, 0)));
  }, [results.length]);

  if (!presence.present) return null;

  const trimmed = query.trim();
  const selected = results[activeIndex];

  const selectTool = (tool: Tool) => {
    onSelectTool(tool);
    onClose();
  };

  return (
    <div
      className="modal-backdrop modal-backdrop--search"
      data-state={presence.exiting ? 'closing' : 'open'}
      aria-hidden={presence.exiting || undefined}
      ref={(element) => { element?.toggleAttribute('inert', presence.exiting); }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <h2 id="search-dialog-title" className="sr-only">
          搜索工具目录
        </h2>
        <div className="search-dialog__field">
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="搜索工具、分类或关键词"
            aria-expanded="true"
            aria-controls="catalog-search-results"
            aria-autocomplete="list"
            aria-activedescendant={selected ? `catalog-search-option-${activeIndex}` : undefined}
            placeholder="搜索工具、能力或场景…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (selected) selectTool(selected);
                else if (trimmed) onShowAll(trimmed);
              }
            }}
          />
          {query ? (
            <button
              type="button"
              className="search-dialog__clear"
              aria-label="清空搜索"
              onClick={() => {
                setQuery('');
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
          <kbd className="search-dialog__esc">Esc</kbd>
          <button type="button" className="icon-button search-dialog__close" onClick={onClose} aria-label="关闭搜索">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="search-dialog__body">
          {!trimmed ? (
            <div className="search-suggestions">
              <p className="search-dialog__label">按分类找</p>
              <div className="search-category-grid">
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className="search-category"
                    onClick={() => {
                      onSelectCategory(category);
                      onClose();
                    }}
                  >
                    <span aria-hidden="true">
                      <CategoryIcon id={category.id} size={15} />
                    </span>
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="search-results-head">
            <p className="search-dialog__label">{trimmed ? '搜索结果' : '精选工具'}</p>
            {trimmed ? <span>{results.length ? `展示前 ${results.length} 个` : '没有匹配'}</span> : null}
          </div>

          {results.length > 0 ? (
            <div id="catalog-search-results" role="listbox" aria-label="搜索建议">
              {results.map((tool, index) => (
                <button
                  type="button"
                  id={`catalog-search-option-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  className={`search-result${index === activeIndex ? ' is-active' : ''}`}
                  key={tool.id}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectTool(tool)}
                >
                  <ToolLogo tool={tool} className="search-result__logo" />
                  <span className="search-result__text">
                    <strong>{tool.name}</strong>
                    <span>{tool.tagline}</span>
                  </span>
                  <span className="search-result__category">
                    {categoryNames.get(tool.categoryId) ?? '工具'}
                  </span>
                  <ArrowRight size={15} className="search-result__arrow" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="search-empty">
              <p>没有找到“{trimmed}”相关的工具。</p>
            </div>
          )}
        </div>

        <div className="search-dialog__foot">
          <span className="search-dialog__hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            选择
            <kbd>↵</kbd>
            打开
          </span>
          <button
            type="button"
            className="search-dialog__all"
            onClick={() => {
              onShowAll(trimmed);
              onClose();
            }}
          >
            {trimmed ? '查看全部结果' : '浏览全部工具'}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
