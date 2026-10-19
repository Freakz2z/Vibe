import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Boxes,
  Braces,
  ChartColumn,
  Clapperboard,
  CodeXml,
  Database,
  FileCode2,
  FlaskConical,
  GitBranch,
  Keyboard,
  Layers,
  ListChecks,
  MapPinned,
  MousePointerClick,
  Network,
  Orbit,
  Palette,
  PenLine,
  Rocket,
  ScrollText,
  ServerCog,
  Shapes,
  Sigma,
  Smartphone,
  Sparkles,
  Table2,
  Terminal,
  Type,
  Waypoints,
  Workflow,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'ai-coding': Bot,
  'frontend-ui': CodeXml,
  motion: Clapperboard,
  charts: ChartColumn,
  backend: Database,
  devops: Rocket,
  mobile: Smartphone,
  design: Palette,
  content: PenLine,
  productivity: ListChecks,
};

/**
 * Demo icons are keyed by the demo's primary stack (the tool id), because every
 * published demo now genuinely runs exactly one library or one real service.
 */
const STACK_ICONS: Record<string, LucideIcon> = {
  // 动画图形
  gsap: Waypoints,
  motion: MousePointerClick,
  'react-spring': Orbit,
  threejs: Boxes,
  pixijs: Sparkles,
  matterjs: Orbit,
  paperjs: Shapes,
  animejs: Waypoints,
  'lottie-web': Sparkles,
  swiper: Layers,
  'embla-carousel': Layers,
  'dnd-kit': Keyboard,
  'auto-animate': Layers,
  moveable: MousePointerClick,
  // 图表与图
  echarts: ChartColumn,
  d3: Workflow,
  chartjs: ChartColumn,
  recharts: ChartColumn,
  'observable-plot': Sigma,
  uplot: ChartColumn,
  g6: Network,
  x6: GitBranch,
  mermaid: Workflow,
  'react-flow': GitBranch,
  leaflet: MapPinned,
  'maplibre-gl': MapPinned,
  // 状态与表单
  zod: ScrollText,
  'tanstack-query': ServerCog,
  swr: ServerCog,
  zustand: Boxes,
  'redux-toolkit': Boxes,
  jotai: Sigma,
  htmx: ServerCog,
  'radix-ui': Keyboard,
  'ant-design': Table2,
  mantine: ScrollText,
  // 编辑与内容
  tiptap: PenLine,
  lexical: Type,
  prosemirror: Workflow,
  quill: PenLine,
  codemirror: CodeXml,
  'markdown-it': FileCode2,
  shiki: CodeXml,
  katex: Sigma,
  remark: Braces,
  // 实用工具
  culori: Palette,
  colorjs: Palette,
  prettier: CodeXml,
  typescript: CodeXml,
  esbuild: Terminal,
  // 本站真实服务
  d1: Database,
  drizzle: Database,
  kysely: Database,
  hono: ServerCog,
  r2: Database,
};

interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CategoryIcon({ id, size = 16, strokeWidth = 1.9, className }: IconProps & { id: string }) {
  const Icon = CATEGORY_ICONS[id] ?? Layers;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

export function DemoStackIcon({ stack, size = 16, strokeWidth = 1.9, className }: IconProps & { stack: string }) {
  const Icon = STACK_ICONS[stack] ?? FlaskConical;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

export function DemoEntryIcon({ size = 16, className }: IconProps) {
  return <FlaskConical size={size} strokeWidth={1.9} className={className} aria-hidden="true" />;
}
