import { routeHref } from '../lib/runtime';
import { ArrowUpRight } from 'lucide-react';
import type { Demo, Tool } from '../types';
import { DemoThumb } from './LabThumb';
import { DemoStackIcon } from './icons';
import { stackLabel } from '../lib/catalog';


export function DemoCard({ demo, tool }: { demo: Demo; tool?: Tool }) {
  return (
    <a className="demo-card" href={routeHref(`/demos/${demo.id}`)}>
      <div className="demo-card__visual">
        <DemoThumb stack={demo.stack} />
        <span className="demo-card__badge">{demo.kind === 'service' ? '本站接口' : '可操作'}</span>
      </div>
      <div className="demo-card__body">
        <p className="demo-card__kind">
          <DemoStackIcon stack={demo.stack} size={14} />
          {tool?.name ?? demo.stack}
        </p>
        <h3>{demo.name}</h3>
        <p className="demo-card__description">{demo.description}</p>
        <div className="demo-card__footer">
          <span>{demo.kind === 'service' ? '本站接口' : stackLabel(demo.stack)}</span>
          <span className="demo-card__open">
            打开体验
            <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </div>
      </div>
    </a>
  );
}
