import type { Category, Tool } from '../types';

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

/** Human label for each demo stack. Falls back to the tool id itself. */
export const stackLabels: Record<string, string> = {
  gsap: '时间轴编排', motion: '共享布局动效', 'react-spring': '弹簧物理',
  threejs: '实例化 3D 场景', pixijs: 'WebGL 精灵批处理', matterjs: '刚体物理',
  paperjs: '矢量布尔运算', animejs: 'SVG 动画', 'lottie-web': '矢量动画播放',
  swiper: '触摸分页', 'embla-carousel': '吸附轮播', 'dnd-kit': '拖拽排序',
  'auto-animate': 'DOM 变更动画', moveable: '自由拖拽缩放旋转',
  echarts: '大数据量图表', d3: '数据连接与比例尺', chartjs: '响应式图表',
  recharts: '联动图表', 'observable-plot': '统计图表', uplot: '高频时序',
  g6: '图关系分析', x6: '流程图编辑', mermaid: '文本转图表',
  'react-flow': '节点流程画布', leaflet: '地理图层', 'maplibre-gl': 'WebGL 地图',
  zod: '结构校验', 'tanstack-query': '服务端状态缓存', swr: '请求缓存',
  zustand: '轻量状态', 'redux-toolkit': '可预测状态', jotai: '原子化状态',
  htmx: 'HTML 片段交互', 'radix-ui': '无障碍交互', 'ant-design': '数据表格',
  mantine: '表单流程',
  tiptap: '结构化富文本', lexical: '可扩展富文本', prosemirror: '编辑器内核',
  quill: 'Delta 文档模型', codemirror: '代码编辑器', 'markdown-it': 'Markdown 解析',
  shiki: '语法高亮', katex: '公式排版', remark: 'Markdown AST',
  culori: '色彩空间计算', colorjs: '色彩管理与色域', prettier: '代码格式化',
  typescript: '类型诊断', esbuild: '实时编译',
  d1: '云端 SQL 数据库', drizzle: '类型安全 ORM', kysely: '可组合查询',
  hono: '边缘路由', r2: '对象存储读取',
};

export function stackLabel(stack: string): string {
  return stackLabels[stack] ?? stack;
}

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
