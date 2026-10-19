import { ArrowLeft, ArrowUpRight, ExternalLink, Sparkles } from 'lucide-react';
import type { Demo, Tool } from '../types';
import { demoKindLabels } from '../lib/catalog';
import { DemoRenderer } from '../demos/DemoRenderer';
import type { DemoCopyHandler } from '../demos/types';
import { DemoKindIcon } from '../components/icons';
import { ToolLogo } from '../components/ToolLogo';

interface DemoPageProps {
  demo: Demo;
  tools: Tool[];
  onCopy: DemoCopyHandler;
  onBackToDemos: (fallback: string) => void;
}

export function DemoPage({ demo, tools, onCopy, onBackToDemos }: DemoPageProps) {
  return (
    <article className="page demo-page">
      <nav className="breadcrumb" aria-label="面包屑导航">
        <a
          href="/demos"
          onClick={(event) => {
            event.preventDefault();
            onBackToDemos('/demos');
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          站内示例
        </a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{demo.name}</span>
      </nav>

      <header className="demo-page__header">
        <div className="demo-page__meta">
          <span className="principle-badge">原理演示</span>
          <span className="demo-kind-badge">
            <DemoKindIcon kind={demo.kind} size={13} />
            {demoKindLabels[demo.kind]}
          </span>
        </div>
        <h1>{demo.name}</h1>
        <p>{demo.description}</p>
        <div className="demo-page__tools" aria-label="关联工具">
          <span className="demo-page__tools-label">关联工具</span>
          {tools.map((tool) => (
            <a className="tool-chip" href={`/tools/${tool.id}`} key={tool.id}>
              <ToolLogo tool={tool} className="tool-chip__logo" />
              {tool.name}
            </a>
          ))}
        </div>
      </header>

      <DemoRenderer kind={demo.kind} onCopy={onCopy} />

      <aside className="demo-disclaimer">
        <div>
          <p className="eyebrow">说明</p>
          <h2>这是原理演示</h2>
        </div>
        <p>
          示例由本站独立实现，用于解释交互与参数如何影响结果，不加载或代表关联工具的实际运行效果。工具名称仅用于说明这类能力，各工具的功能与实现请以官方文档为准。
        </p>
        <a className="text-link" href="/demos">
          看其他示例
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </aside>

      <div className="demo-page__footer-links">
        <a className="button button--secondary" href="/">
          <Sparkles size={15} aria-hidden="true" />
          回到工具目录
        </a>
        {tools[0] ? (
          <a className="button button--quiet" href={`/tools/${tools[0].id}`}>
            了解 {tools[0].name}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
