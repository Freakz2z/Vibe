import { routeHref } from '../lib/runtime';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import type { Demo, Tool } from '../types';
import { DemoStackIcon } from './icons';
import { ToolLogo } from './ToolLogo';
import { stackLabel } from '../lib/catalog';

interface DemoPageProps {
  demo: Demo;
  tools: Tool[];
  children: ReactNode;
  onBackToDemos: (fallback: string) => void;
}

export function DemoPageLayout({ demo, tools, children, onBackToDemos }: DemoPageProps) {
  const stackTool = tools[0];

  return (
    <article className="page demo-page">
      <nav className="breadcrumb" aria-label="面包屑导航">
        <a
          href={routeHref('/demos')}
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
          <span className="demo-kind-badge">
            <DemoStackIcon stack={demo.stack} size={13} />
            {demo.kind === 'service' ? '本站接口' : '可操作'}
          </span>
          <span className="demo-kind-badge">{stackLabel(demo.stack)}</span>
        </div>
        <h1>{demo.name}</h1>
        <p>{demo.description}</p>
        <div className="demo-page__tools" aria-label="主工具">
          <span className="demo-page__tools-label">主工具</span>
          {stackTool ? (
            <a className="tool-chip" href={routeHref(`/tools/${stackTool.id}`)}>
              <ToolLogo tool={stackTool} className="tool-chip__logo" />
              {stackTool.name}
            </a>
          ) : (
            <span className="tool-chip">{demo.stack}</span>
          )}
          {demo.documentation ? (
            <a className="tool-chip" href={demo.documentation} target="_blank" rel="noopener noreferrer">
              <BookOpen size={13} aria-hidden="true" />
              官方能力文档
            </a>
          ) : null}
        </div>
      </header>

      {children}

      <div className="demo-page__footer-links">
        <a className="button button--secondary" href={routeHref('/demos')}>
          <Sparkles size={15} aria-hidden="true" />
          看其他示例
        </a>
        {stackTool ? (
          <a className="button button--quiet" href={routeHref(`/tools/${stackTool.id}`)}>
            了解 {stackTool.name}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
        {demo.documentation ? (
          <a className="button button--quiet" href={demo.documentation} target="_blank" rel="noopener noreferrer">
            官方文档
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
