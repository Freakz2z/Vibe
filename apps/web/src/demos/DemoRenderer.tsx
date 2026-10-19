import type { Demo } from '../types';
import type { DemoCopyHandler } from './types';
import { SpringDemo } from './SpringDemo';
import { ChartDemo } from './ChartDemo';
import { GradientDemo } from './GradientDemo';
import { KanbanDemo } from './KanbanDemo';
import { ParticlesDemo } from './ParticlesDemo';
import { MarkdownDemo } from './MarkdownDemo';

export function DemoRenderer({ kind, onCopy }: { kind: Demo['kind']; onCopy: DemoCopyHandler }) {
  switch (kind) {
    case 'spring':
      return <SpringDemo />;
    case 'chart':
      return <ChartDemo />;
    case 'gradient':
      return <GradientDemo onCopy={onCopy} />;
    case 'kanban':
      return <KanbanDemo />;
    case 'particles':
      return <ParticlesDemo />;
    case 'markdown':
      return <MarkdownDemo />;
    default:
      return null;
  }
}
