import { IS_TOY } from '../../lib/runtime';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Graph } from '@antv/g6';
import type { GraphData, IElementEvent } from '@antv/g6';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Segmented, Stat, Stats, Status, useStableId, useThemeColors } from '../lab-kit';

const G6_VERSION = '5.0.49';
type LayoutKey = 'force' | 'dagre' | 'grid';
const DEFAULT_LAYOUT: LayoutKey = IS_TOY ? 'grid' : 'force';
const layoutOptions = (key: LayoutKey) => key === 'grid'
  ? {type: 'grid', preventOverlap: true, nodeSize: 32, nodeSpacing: 22}
  : key === 'force' ? { type: 'force', preventOverlap: true, nodeSize: 32, linkDistance: 96, nodeStrength: -32 }
  : { type: 'dagre', rankdir: 'LR', nodesep: 16, ranksep: 68 };

const LAYOUTS: readonly (readonly [LayoutKey, string])[] = [
  ...(IS_TOY ? [['grid', '网格布局'] as const] : []),
  ['force', '力导向'],
  ['dagre', '有向分层'],
];

interface Service {
  id: string;
  name: string;
  group: '网关' | '业务' | '数据' | '存储';
  qps: number;
  latency: number;
}

const SERVICES: Service[] = [
  { id: 'gw', name: 'api-gateway', group: '网关', qps: 18200, latency: 12 },
  { id: 'auth', name: 'auth-service', group: '网关', qps: 9400, latency: 24 },
  { id: 'route', name: 'router', group: '网关', qps: 12100, latency: 18 },
  { id: 'order', name: 'order-service', group: '业务', qps: 4300, latency: 96 },
  { id: 'user', name: 'user-service', group: '业务', qps: 7600, latency: 41 },
  { id: 'search', name: 'search-service', group: '业务', qps: 5200, latency: 132 },
  { id: 'feed', name: 'feed-service', group: '业务', qps: 14800, latency: 37 },
  { id: 'notify', name: 'notify-worker', group: '业务', qps: 2900, latency: 63 },
  { id: 'event', name: 'event-bus', group: '数据', qps: 21400, latency: 5 },
  { id: 'cdc', name: 'change-capture', group: '数据', qps: 6400, latency: 21 },
  { id: 'etl', name: 'etl-pipeline', group: '数据', qps: 1800, latency: 410 },
  { id: 'metric', name: 'metrics-store', group: '数据', qps: 31000, latency: 8 },
  { id: 'pg', name: 'pg-primary', group: '存储', qps: 8700, latency: 6 },
  { id: 'redis', name: 'redis-cluster', group: '存储', qps: 41000, latency: 1 },
  { id: 'oss', name: 'object-store', group: '存储', qps: 2100, latency: 88 },
  { id: 'mq', name: 'kafka', group: '存储', qps: 26500, latency: 4 },
];

const LINKS: [string, string][] = [
  ['gw', 'auth'], ['gw', 'route'], ['gw', 'feed'], ['gw', 'search'],
  ['route', 'order'], ['route', 'user'], ['route', 'feed'],
  ['feed', 'event'], ['order', 'event'], ['search', 'pg'], ['search', 'oss'],
  ['user', 'redis'], ['order', 'pg'], ['order', 'mq'], ['auth', 'redis'],
  ['event', 'mq'], ['mq', 'etl'], ['cdc', 'etl'], ['etl', 'oss'],
  ['metric', 'redis'], ['gw', 'metric'], ['route', 'metric'], ['notify', 'mq'],
];

/**
 * AntV G6 5.x: the whole graph is declared in `new Graph({ data, node, edge,
 * layout })` and materialised by `await graph.render()`. Node drag comes from
 * the built-in `drag-element` behaviour.
 */
export default function G6Lab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [layout, setLayout] = useState<LayoutKey>(DEFAULT_LAYOUT);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>('gw');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const themeKey = useStableId('g6');

  const ink = colors.ink ?? '#222';
  const muted = colors.muted ?? '#888';
  const line = colors.line ?? '#ddd';
  const accent = colors.accent ?? '#e2725b';
  const soft = colors['accent-soft'] ?? '#f6e3dc';
  const surface = colors.surface ?? '#fff';

  const groupColor = useMemo(
    () => ({ 网关: accent, 业务: '#547ec5', 数据: '#2a937b', 存储: '#9870bf' }) as Record<Service['group'], string>,
    [accent, ink, muted, soft],
  );

  const buildData = useCallback(
    (): GraphData => ({
      nodes: SERVICES.map((s) => ({
        id: s.id,
        data: { ...s } as Record<string, unknown>,
        style: {
          fill: groupColor[s.group],
          stroke: surface,
          lineWidth: 2,
          labelText: ({gw:'网关',auth:'认证',route:'路由',order:'订单',user:'用户',search:'搜索',feed:'信息流',notify:'通知',event:'事件总线',cdc:'变更捕获',etl:'数据管道',metric:'指标',pg:'数据库',redis:'缓存',oss:'对象存储',mq:'消息队列'} as Record<string,string>)[s.id],
          labelFill: muted,
          labelFontSize: 12,
          labelPlacement: 'bottom',
          size: 14 + Math.min(18, Math.log10(Math.max(1, s.qps)) * 3.2),
        },
      })),
      edges: LINKS.map(([source, target], i) => ({
        id: `e${i}`,
        source,
        target,
        style: { stroke: line, lineWidth: 1.4 },
      })),
    }),
    [groupColor, line, muted, surface],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    setReady(false);
    const graph = new Graph({
      container: host,
      data: buildData(),
      autoFit: 'view',
      animation: false,
      node: { style: { cursor: 'pointer' } },
      edge: { style: { endArrow: true } },
      layout: layoutOptions(layout),
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'click-select'],
    });
    graphRef.current = graph;

    const onNodeClick = (event: IElementEvent) => {
      const id = event.target.id;
      setSelected(id);
    };

    graph.on('node:click', onNodeClick);

    // G6 的 render() 是异步的：prepare() 会先让出一次微任务才继续渲染，
    // 如果在那之前 destroy()，G6 会在控制台打印 “graph instance has been destroyed”。
    // 所以把 render() 收进 Promise，cleanup 等它 settle 之后再拆实例。
    const rendered = graph
      .render()
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      });

    const observer = new ResizeObserver(() => {
      if (graph.destroyed) return;
      graph.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    });
    observer.observe(host);

    return () => {
      cancelled = true;
      observer.disconnect();
      graph.off('node:click', onNodeClick);
      void rendered.then(() => {
        if (graphRef.current === graph) graphRef.current = null;
        if (!graph.destroyed) graph.destroy();
      });
    };
  }, [buildData, layout, revision, themeKey]);

  const switchLayout = (next: LayoutKey) => {
    // The effect renders the new layout. Running graph.layout() on the old
    // instance as well races its asynchronous work against effect cleanup.
    setLayout(next);
  };

  const reset = () => {
    setSelected('gw');
    switchLayout(DEFAULT_LAYOUT);
    setRevision(value => value + 1);
  };

  const current = SERVICES.find((s) => s.id === selected) ?? null;
  const neighbours = useMemo(() => {
    if (!selected) return [] as Service[];
    const linked = new Set<string>();
    for (const [source, target] of LINKS) {
      if (source === selected) linked.add(target);
      if (target === selected) linked.add(source);
    }
    return SERVICES.filter((s) => linked.has(s.id));
  }, [selected]);

  const snippet = useMemo(
    () =>
      [
        `const graph = new Graph({`,
        `  container,`,
        `  data: { nodes, edges },`,
        `  autoFit: 'view',`,
        `  node: { style: { cursor: 'pointer' } },`,
        `  edge: { style: { endArrow: true } },`,
        `  layout: ${JSON.stringify(layoutOptions(layout))},`,
        `  behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'click-select'],`,
        `});`,
        ``,
        `await graph.render();`,
        `graph.setLayout({ type: '${layout === 'force' ? 'dagre' : 'force'}' });`,
        `graph.layout();`,
        `graph.on('node:click', (evt) => { const id = evt.target.id; /* 读取真实节点数据 */ });`,
        `graph.resize(w, h);`,
        `graph.destroy();`,
      ].join('\n'),
    [layout],
  );

  return (
    <Lab title={IS_TOY ? "AntV G6 关系图布局" : "AntV G6 力导向关系图"} badge={<span className="demo-live-badge">G6 {G6_VERSION}</span>} reset={reset}>
      <LabLayout
        controls={
          <>
            <div data-lab-actions><Segmented<LayoutKey> label="布局算法" value={layout} options={LAYOUTS} onChange={switchLayout} /></div>
            <Status tone={ready ? 'ok' : undefined}>
              {ready ? 'graph.render() 已完成。' : '正在执行 graph.render()…'} 拖动节点可直接改写位置，滚轮缩放、空白处拖动画布。
            </Status>
            {current ? (
              <div className="lab-g6-detail">
                <strong>{current.name}</strong>
                <small>分组：{current.group}</small>
                <small>QPS：{current.qps.toLocaleString('zh-CN')}</small>
                <small>P99：{current.latency} ms</small>
                <small>邻居数：{neighbours.length}</small>
              </div>
            ) : (
              <Status>点击任意节点查看它的真实数据与邻居。</Status>
            )}
          </>
        }
      >
        {error ? <ErrorNote onRetry={reset}>G6 渲染失败：{error}</ErrorNote> : null}
        <div className="lab-g6-canvas" ref={hostRef} role="img" aria-label="服务依赖关系图" />
        <div style={{ marginTop: 14 }}>
          <Stats>
            <Stat label="节点" value={SERVICES.length} />
            <Stat label="边" value={LINKS.length} />
            <Stat label="选中节点邻居" value={neighbours.length} />
          </Stats>
        </div>
      </LabLayout>

      <div style={{ marginTop: 22 }}>
        <DataTable
          head={['服务', '分组', 'QPS', 'P99 (ms)', '与选中节点关系']}
          rows={neighbours.map((s) => [
            s.name,
            s.group,
            s.qps.toLocaleString('zh-CN'),
            String(s.latency),
            LINKS.some(([a, b]) => (a === selected && b === s.id) || (b === selected && a === s.id)) ? (LINKS.find(([a, b]) => a === selected && b === s.id) ? '下游' : '上游') : '—',
          ])}
          caption={selected ? `${current?.name ?? selected} 的邻居节点` : '未选中节点'}
        />
      </div>

      <Code text={snippet} onCopy={onCopy} label="G6 调用" />
    </Lab>
  );
}
