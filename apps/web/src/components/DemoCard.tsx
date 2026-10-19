import { ArrowUpRight } from 'lucide-react';
import type { Demo } from '../types';
import { demoKindLabels } from '../lib/catalog';
import { DemoThumb } from './DemoThumb';

export function DemoCard({ demo }: { demo: Demo }) {
  return (
    <a className="demo-card" href={`/demos/${demo.id}`}>
      <div className="demo-card__visual">
        <DemoThumb kind={demo.kind} />
        <span className="demo-card__badge">原理演示</span>
      </div>
      <div className="demo-card__body">
        <p className="demo-card__kind">{demoKindLabels[demo.kind]}</p>
        <h3>{demo.name}</h3>
        <p className="demo-card__description">{demo.description}</p>
        <div className="demo-card__footer">
          <span>关联 {demo.toolIds.length} 个工具</span>
          <span className="demo-card__open">
            打开体验
            <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </div>
      </div>
    </a>
  );
}
