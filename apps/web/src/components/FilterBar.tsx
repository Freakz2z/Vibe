import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ListFilter, SlidersHorizontal, X } from 'lucide-react';
import type { Tool } from '../types';
import { useDialog } from '../hooks/useDialog';
import { usePresence } from '../hooks/usePresence';

export type FilterKey = 'q' | 'category' | 'platform' | 'pricing' | 'favorites';

export interface ActiveFilter {
  key: FilterKey;
  label: string;
}

interface FilterBarProps {
  platform: string;
  pricing: string;
  activeFilters: ActiveFilter[];
  resultCount: number;
  onPlatformChange: (value: string) => void;
  onPricingChange: (value: string) => void;
  onRemoveFilter: (key: FilterKey) => void;
  onClearAll: () => void;
}

const PLATFORMS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'Web', label: 'Web' },
  { value: 'Mobile', label: '移动端' },
  { value: 'CLI', label: '命令行' },
];

const PRICING: { value: Tool['pricing'] | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: '开源免费', label: '开源免费' },
  { value: '免费使用', label: '免费使用' },
  { value: '免费增值', label: '免费增值' },
  { value: '付费', label: '付费' },
];

function FilterGroups({
  platform,
  pricing,
  idPrefix,
  onPlatformChange,
  onPricingChange,
}: {
  platform: string;
  pricing: string;
  idPrefix: string;
  onPlatformChange: (value: string) => void;
  onPricingChange: (value: string) => void;
}) {
  return (
    <div className="filter-panel__groups">
      <div className="filter-group" role="group" aria-labelledby={`${idPrefix}-platform`}>
        <span className="filter-group__label" id={`${idPrefix}-platform`}>
          平台
        </span>
        <div className="chip-row">
          {PLATFORMS.map((item) => {
            const active = platform === item.value;
            return (
              <button
                type="button"
                key={item.value || 'all'}
                className={`filter-chip${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => onPlatformChange(item.value)}
              >
                {active ? <Check size={12} aria-hidden="true" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-group" role="group" aria-labelledby={`${idPrefix}-pricing`}>
        <span className="filter-group__label" id={`${idPrefix}-pricing`}>
          费用
        </span>
        <div className="chip-row">
          {PRICING.map((item) => {
            const active = pricing === item.value;
            return (
              <button
                type="button"
                key={item.value || 'all'}
                className={`filter-chip${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => onPricingChange(item.value)}
              >
                {active ? <Check size={12} aria-hidden="true" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActiveFilterList({
  activeFilters,
  onRemoveFilter,
  onClearAll,
  compact = false,
  showReset = true,
}: {
  activeFilters: ActiveFilter[];
  onRemoveFilter: (key: FilterKey) => void;
  onClearAll: () => void;
  compact?: boolean;
  showReset?: boolean;
}) {
  if (activeFilters.length === 0) return null;

  return (
    <div className={`active-filter-list${compact ? ' active-filter-list--compact' : ''}`} aria-label="已选条件">
      {activeFilters.map((filter) => (
        <span className="active-filter" key={filter.key}>
          <span>{filter.label}</span>
          <button
            type="button"
            className="active-filter__remove"
            aria-label={`移除${filter.label}`}
            onClick={() => onRemoveFilter(filter.key)}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      {showReset ? (
        <button type="button" className="active-filter__reset" onClick={onClearAll}>
          全部重置
        </button>
      ) : null}
    </div>
  );
}

export function FilterBar({
  platform,
  pricing,
  activeFilters,
  resultCount,
  onPlatformChange,
  onPricingChange,
  onRemoveFilter,
  onClearAll,
}: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const presence = usePresence(sheetOpen);

  useDialog(sheetOpen, sheetRef, closeSheet);

  useEffect(() => {
    if (!sheetOpen) return;
    const media = window.matchMedia('(max-width: 720px)');
    const onChange = () => {
      if (!media.matches) closeSheet();
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [closeSheet, sheetOpen]);

  const handleClearAll = () => {
    onClearAll();
    closeSheet();
  };

  return (
    <div className="filter-area">
      <div className="filter-mobile-bar">
        <button
          type="button"
          className="filter-toggle"
          ref={triggerRef}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <ListFilter size={16} aria-hidden="true" />
          筛选
          {activeFilters.length > 0 ? (
            <span className="filter-toggle__count">{activeFilters.length}</span>
          ) : null}
        </button>
        <ActiveFilterList
          activeFilters={activeFilters}
          onRemoveFilter={onRemoveFilter}
          onClearAll={onClearAll}
          compact
        />
      </div>

      <section className="filter-panel" aria-label="筛选工具">
        <div className="filter-panel__head">
          <h2 className="filter-panel__title">
            <SlidersHorizontal size={15} aria-hidden="true" />
            筛选
          </h2>
          <span className="filter-panel__status" role="status" aria-live="polite">
            共 {resultCount} 个工具
          </span>
        </div>
        <ActiveFilterList
          activeFilters={activeFilters}
          onRemoveFilter={onRemoveFilter}
          onClearAll={onClearAll}
        />
        <FilterGroups
          platform={platform}
          pricing={pricing}
          idPrefix="desktop"
          onPlatformChange={onPlatformChange}
          onPricingChange={onPricingChange}
        />
      </section>

      {presence.present ? (
        <div
          className="filter-sheet-backdrop"
          data-state={presence.exiting ? 'closing' : 'open'}
          aria-hidden={presence.exiting || undefined}
          ref={(element) => { element?.toggleAttribute('inert', presence.exiting); }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeSheet();
          }}
        >
          <div
            className="filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-sheet-title"
            ref={sheetRef}
            tabIndex={-1}
          >
            <div className="filter-sheet__head">
              <h2 id="filter-sheet-title">筛选</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="关闭筛选"
                onClick={closeSheet}
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <div className="filter-sheet__body">
              <p className="filter-sheet__status" role="status" aria-live="polite">
                共 {resultCount} 个工具
              </p>
              <ActiveFilterList
                activeFilters={activeFilters}
                onRemoveFilter={onRemoveFilter}
                onClearAll={onClearAll}
                compact
                showReset={false}
              />
              <FilterGroups
                platform={platform}
                pricing={pricing}
                idPrefix="mobile"
                onPlatformChange={onPlatformChange}
                onPricingChange={onPricingChange}
              />
            </div>
            <div className="filter-sheet__foot">
              {activeFilters.length > 0 ? (
                <button type="button" className="button button--quiet" onClick={handleClearAll}>
                  全部重置
                </button>
              ) : null}
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  closeSheet();
                  triggerRef.current?.focus({ preventScroll: true });
                }}
              >
                查看 {resultCount} 个工具
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
