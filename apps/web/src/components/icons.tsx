import {
  Bot,
  ChartColumn,
  Clapperboard,
  CodeXml,
  Columns3,
  Database,
  FileCode2,
  FlaskConical,
  Layers,
  ListChecks,
  Orbit,
  Palette,
  PenLine,
  Rocket,
  Smartphone,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { Demo } from '../types';

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

const DEMO_ICONS: Record<Demo['kind'], LucideIcon> = {
  spring: Waves,
  chart: ChartColumn,
  gradient: Palette,
  kanban: Columns3,
  particles: Orbit,
  markdown: FileCode2,
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

export function DemoKindIcon({
  kind,
  size = 16,
  strokeWidth = 1.9,
  className,
}: IconProps & { kind: Demo['kind'] }) {
  const Icon = DEMO_ICONS[kind] ?? FlaskConical;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

export function DemoEntryIcon({ size = 16, className }: IconProps) {
  return (
    <FlaskConical size={size} strokeWidth={1.9} className={className} aria-hidden="true" />
  );
}
