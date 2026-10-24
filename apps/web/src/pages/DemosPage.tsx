import { routeHref } from '../lib/runtime';
import { useMemo, useState } from 'react';
import type { Demo, Tool } from '../types';
import { DemoCard } from '../components/DemoCard';
import { stackLabel } from '../lib/catalog';

export function DemosPage({ demos, tools }: { demos: Demo[]; tools: Tool[] }) {
  const [query, setQuery] = useState('');
  const toolNames = useMemo(() => new Map(tools.map((tool) => [tool.id, tool.name])), [tools]);
  const shown = demos.filter((demo) => {
    const haystack = [
      demo.name,
      demo.description,
      demo.stack,
      stackLabel(demo.stack),
      demo.kind === 'service' ? '真实服务' : '真实运行',
      toolNames.get(demo.stack) ?? demo.stack,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="page demos-page">
      <header className="browse-heading demos-page__heading">
        <div className="browse-heading__title-row">
          <h1>站内示例</h1>
          <span className="browse-heading__count">{demos.length} 个</span>
        </div>
        <label className="lab-field demos-search">
          <span className="sr-only">搜索示例</span>
          <input type="search" placeholder="搜索示例或主工具" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </header>

      <div className="demo-grid demo-grid--page">
        {shown.map((demo) => (
          <DemoCard key={demo.id} demo={demo} tool={toolNames.get(demo.stack) ? tools.find((t) => t.id === demo.stack) : undefined} />
        ))}
      </div>

      {shown.length === 0 && (
        <div className="empty-state">
          <h3>没有匹配的示例</h3>
          <button className="button button--secondary" onClick={() => setQuery('')}>
            清除搜索
          </button>
        </div>
      )}

      <aside className="demo-page-note">
        <a className="text-link" href={routeHref('/')}>
          回到工具目录
        </a>
      </aside>
    </div>
  );
}
