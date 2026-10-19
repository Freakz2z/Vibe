import type { Category, Demo, Tool } from '../types';

export interface ToolFilters {
  q: string;
  category: string;
  platform: string;
  pricing: string;
  favorites: boolean;
}

export const platformLabels: Record<Tool['platforms'][number], string> = {
  Web: 'Web',
  Mobile: '移动端',
  CLI: '命令行',
};

export const shortPlatformLabels: Record<Tool['platforms'][number], string> = {
  Web: 'Web',
  Mobile: '移动',
  CLI: 'CLI',
};

export const pricingLabels: Record<Tool['pricing'], string> = {
  开源免费: '开源免费',
  免费使用: '免费使用',
  免费增值: '免费增值',
  付费: '付费',
};

export type PricingTone = 'open' | 'free' | 'freemium' | 'paid';

export const pricingTones: Record<Tool['pricing'], PricingTone> = {
  开源免费: 'open',
  免费使用: 'free',
  免费增值: 'freemium',
  付费: 'paid',
};

export const demoKindLabels: Record<Demo['kind'], string> = {
  spring: '弹性运动',
  chart: '数据图表',
  gradient: '色彩渐变',
  kanban: '拖拽排序',
  particles: 'Canvas 粒子',
  markdown: '安全解析',
};

export function formatUpdatedAt(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[1]}.${match[2]}.${match[3]}`;
}

export function toolMatches(tool: Tool, rawQuery: string, categoryName = ''): boolean {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return true;

  const haystack = [
    tool.name,
    tool.tagline,
    tool.description,
    tool.tags.join(' '),
    tool.useCases.join(' '),
    categoryName,
  ]
    .join(' ')
    .toLocaleLowerCase();

  return query.split(/\s+/).every((token) => haystack.includes(token));
}

export function filterTools(
  tools: Tool[],
  categories: Category[],
  filters: ToolFilters,
  favoriteIds: ReadonlySet<string>,
): Tool[] {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return tools.filter((tool) => {
    if (filters.category && tool.categoryId !== filters.category) return false;
    if (filters.platform && !tool.platforms.includes(filters.platform as Tool['platforms'][number])) return false;
    if (filters.pricing && tool.pricing !== filters.pricing) return false;
    if (filters.favorites && !favoriteIds.has(tool.id)) return false;
    return toolMatches(tool, filters.q, categoryNames.get(tool.categoryId));
  });
}

export function groupTools(
  tools: Tool[],
  categories: Category[],
): { category: Category; tools: Tool[] }[] {
  const groups = new Map<string, Tool[]>();
  for (const tool of tools) {
    const list = groups.get(tool.categoryId) ?? [];
    list.push(tool);
    groups.set(tool.categoryId, list);
  }

  return categories
    .map((category) => ({
      category,
      tools: (groups.get(category.id) ?? []).slice().sort((a, b) => Number(b.featured) - Number(a.featured)),
    }))
    .filter((group) => group.tools.length > 0);
}
