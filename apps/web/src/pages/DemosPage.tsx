import { useState } from 'react';
import type { Demo } from '../types';
import { DemoCard } from '../components/DemoCard';
import { demoKindLabels } from '../lib/catalog';
export function DemosPage({ demos }: { demos: Demo[] }) {
  const [query, setQuery] = useState('');
  const shown = demos.filter(d => `${d.name} ${d.description} ${demoKindLabels[d.kind]}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="page demos-page">
    <header className="browse-heading demos-page__heading"><div className="browse-heading__title-row"><h1>站内示例</h1><span className="browse-heading__count">{demos.length} 个</span></div><label className="lab-field demos-search"><span className="sr-only">搜索示例</span><input type="search" placeholder="搜索示例" value={query} onChange={e => setQuery(e.target.value)} /></label></header>
    <div className="demo-grid demo-grid--page">{shown.map(demo => <DemoCard key={demo.id} demo={demo} />)}</div>
    {shown.length === 0 && <div className="empty-state"><h2>没有匹配的示例</h2><button className="button button--secondary" onClick={() => setQuery('')}>清除搜索</button></div>}
    <aside className="demo-page-note"><p><strong>原理演示</strong>示例由本站独立实现，关联工具用于说明对应能力。</p><a className="text-link" href="/">回到工具目录</a></aside>
  </div>;
}
