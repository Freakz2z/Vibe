import type { Tool } from '../types';

interface FilterBarProps {
  platform: string;
  pricing: string;
  hasFilters: boolean;
  onPlatformChange: (value: string) => void;
  onPricingChange: (value: string) => void;
  onClear: () => void;
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

export function FilterBar({
  platform,
  pricing,
  hasFilters,
  onPlatformChange,
  onPricingChange,
  onClear,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="filter-group" role="group" aria-label="按平台筛选">
        <span className="filter-group__label">平台</span>
        <div className="chip-row">
          {PLATFORMS.map((item) => (
            <button
              type="button"
              key={item.value || 'all'}
              className={`filter-chip${platform === item.value ? ' is-active' : ''}`}
              aria-pressed={platform === item.value}
              onClick={() => onPlatformChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group" role="group" aria-label="按授权筛选">
        <span className="filter-group__label">授权</span>
        <div className="chip-row">
          {PRICING.map((item) => (
            <button
              type="button"
              key={item.value || 'all'}
              className={`filter-chip${pricing === item.value ? ' is-active' : ''}`}
              aria-pressed={pricing === item.value}
              onClick={() => onPricingChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {hasFilters ? (
        <button type="button" className="filter-clear" onClick={onClear}>
          清除筛选
        </button>
      ) : null}
    </div>
  );
}
