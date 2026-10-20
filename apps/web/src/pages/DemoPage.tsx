import type { Demo, Tool } from '../types';
import { DemoPageLayout } from '../components/DemoPageLayout';
import { DemoRenderer } from '../demos/DemoRenderer';
import type { DemoCopyHandler } from '../demos/types';

export function DemoPage({ demo, tools, onCopy, onBackToDemos }: {
  demo: Demo; tools: Tool[]; onCopy: DemoCopyHandler; onBackToDemos: (fallback: string) => void;
}) {
  return <DemoPageLayout demo={demo} tools={tools} onBackToDemos={onBackToDemos}>
    <DemoRenderer demo={demo} onCopy={onCopy} />
  </DemoPageLayout>;
}
