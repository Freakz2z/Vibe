import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Graph } from '@antv/x6';
import type { Cell, Edge } from '@antv/x6';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, LabLayout, Select, Stat, Stats, Status, prettyJSON, useStableId, useThemeColors } from '../lab-kit';

const X6_VERSION = '2.18.1';

type NodeKind = 'gateway' | 'service' | 'queue' | 'db';

const KINDS: readonly (readonly [NodeKind, string])[] = [
  ['gateway', '网关'],
  ['service', '业务服务'],
  ['queue', '消息队列'],
  ['db', '存储'],
];

const KIND_META: Record<NodeKind, { label: string; ports: [string, string] }> = {
  gateway: { label: 'api-gateway', ports: ['gateway-in', 'gateway-out'] },
  service: { label: 'order-service', ports: ['svc-in', 'svc-out'] },
  queue: { label: 'kafka-topic', ports: ['queue-in', 'queue-out'] },
  db: { label: 'pg-primary', ports: ['db-in', 'db-out'] },
};

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * AntV X6 2.x: ports + `edge:connected` are the whole point. Nodes are created
 * with a real `portMarkup`, dragging from one port to another is handled by
 * X6, and the resulting edge gets a manhattan router and an arrow marker. */
export default function X6Lab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [serialized, setSerialized] = useState('{}');
  const [loaded, setLoaded] = useState('');
  const [status, setStatus] = useState('从右侧端口拖到另一个节点即可连线。');
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const themeKey = useStableId('x6');

  const ink = colors.ink ?? '#222';
  const muted = colors.muted ?? '#888';
  const line = colors['line-strong'] ?? '#ccc';
  const accent = colors.accent ?? '#e2725b';
  const soft = colors['accent-soft'] ?? '#f6e3dc';
  const surface = colors.surface ?? '#fff';

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let graph: Graph;
    try {
      graph = new Graph({
        container: host,
        grid: { size: 14, type: 'dot', visible: true },
        panning: true,
        mousewheel: { enabled: false },
        connecting: {
          allowBlank: false,
          allowLoop: false,
          allowNode: true,
          allowEdge: false,
          snap: { radius: 26 },
          highlight: true,
          anchor: { name: 'center' },
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    graphRef.current = graph;

    const addNodeAt = (kind: NodeKind, x: number, y: number) => {
      const meta = KIND_META[kind];
      const id = nextId(kind);
      graph.addNode({
        id,
        x,
        y,
        width: 168,
        height: 54,
        data: { kind, label: meta.label },
        markup: [
          { tagName: 'rect', selector: 'body' },
          { tagName: 'text', selector: 'label' },
        ],
        ports: {
          items: [
            { id: meta.ports[0], group: 'in' },
            { id: meta.ports[1], group: 'out' },
          ],
          groups: {
            in: {
              position: { name: 'left' },
              markup: [{ tagName: 'circle', selector: 'portBody', attrs: { r: 8 } }],
              attrs: { portBody: { fill: surface, stroke: line, strokeWidth: 2 } },
            },
            out: {
              position: { name: 'right' },
              markup: [{ tagName: 'circle', selector: 'portBody', attrs: { r: 8 } }],
              attrs: { portBody: { fill: accent, stroke: surface, strokeWidth: 2 } },
            },
          },
        },
        attrs: {
          body: { rx: 10, ry: 10, fill: surface, stroke: line, strokeWidth: 1 },
          label: { text: meta.label, fill: ink, fontSize: 13, refX: '50%', refY: '50%', textAnchor: 'middle', textVerticalAnchor: 'middle' },
        },
      });
      return id;
    };

    addNodeAt('gateway', 60, 50);
    addNodeAt('service', 300, 50);
    addNodeAt('queue', 540, 40);
    addNodeAt('db', 300, 180);
    setStatus('已创建 4 个带端口的节点。');

    // X6 created the edge on mouse-up; we now give it the real routing/marker.
    // 内置 marker 只有 block/classic/diamond/cross/circle/circlePlus/ellipse，
    // 没有 classicArrow（那是 X6 1.x 的名字，写错会抛 "Marker ... does not exist"）。
    const connected = ({ edge: created }: { edge: Edge }) => {
      created.setRouter('manhattan', { padding: 14 });
      created.setAttrs({
        line: { stroke: accent, strokeWidth: 2, targetMarker: { name: 'block', width: 11, height: 9 } },
      });
      setStatus('edge:connected 已触发：套用 manhattan 路由 + block 箭头。');
    };

    const cellClick = ({ cell }: { cell: Cell }) => {
      setSelected(cell.id);
      cell.attr(cell.isNode() ? 'body/stroke' : 'line/stroke', accent);
      setStatus(`已选中 ${cell.id}`);
    };

    const blankClick = () => {
      setSelected(null);
    };

    graph.on('edge:connected', connected);
    graph.on('cell:click', cellClick);
    graph.on('blank:click', blankClick);

    const observer = new ResizeObserver(() => {
      graph.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      graph.off('edge:connected', connected);
      graph.off('cell:click', cellClick);
      graph.off('blank:click', blankClick);
      graph.dispose();
      graphRef.current = null;
    };
  }, [themeKey, accent, ink, line, surface]);

  const addNode = useCallback((kind: NodeKind) => {
    const graph = graphRef.current;
    if (!graph) return;
    const id = `${kind}-${Math.floor(performance.now() % 100000)}`;
    const meta = KIND_META[kind];
    graph.addNode({
      id,
      x: 40 + ((counter * 37) % 320),
      y: 40 + ((counter * 53) % 180),
      width: 168,
      height: 54,
      data: { kind, label: meta.label },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      ports: {
        items: [
          { id: meta.ports[0], group: 'in' },
          { id: meta.ports[1], group: 'out' },
        ],
        groups: {
          in: { position: { name: 'left' }, markup: [{ tagName: 'circle', selector: 'portBody', attrs: { r: 8 } }], attrs: { portBody: { fill: surface, stroke: line, strokeWidth: 2 } } },
          out: { position: { name: 'right' }, markup: [{ tagName: 'circle', selector: 'portBody', attrs: { r: 8 } }], attrs: { portBody: { fill: accent, stroke: surface, strokeWidth: 2 } } },
        },
      },
      attrs: {
        body: { rx: 10, ry: 10, fill: surface, stroke: line, strokeWidth: 1 },
        label: { text: meta.label, fill: ink, fontSize: 13, refX: '50%', refY: '50%', textAnchor: 'middle', textVerticalAnchor: 'middle' },
      },
    });
    setSelected(id);
    setStatus(`graph.addNode() 新增 ${id}`);
    setTick((n) => n + 1);
  }, [accent, ink, line, surface]);

  /** Programmatic edge with the same router/marker the mouse path produces. */
  const connectProgrammatically = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const nodes = graph.getNodes();
    if (nodes.length < 2) return;
    const [a, b] = nodes;
    graph.addEdge({
      id: nextId('edge'),
      source: { cell: a.id, port: KIND_META[(a.getData() as { kind: NodeKind }).kind]?.ports[1] ?? 'out' },
      target: { cell: b.id, port: KIND_META[(b.getData() as { kind: NodeKind }).kind]?.ports[0] ?? 'in' },
      router: { name: 'manhattan', args: { padding: 14 } },
      connector: { name: 'rounded', args: { radius: 10 } },
      markers: [{ name: 'block', size: 10 }],
      attrs: { line: { stroke: accent, strokeWidth: 2, targetMarker: 'block' } },
      labels: [{ attrs: { label: '程序化连线', textVerticalAnchor: 'middle', fill: muted, fontSize: 11 } }],
    });
    setStatus('graph.addEdge() 用 manhattan 路由 + block 箭头新建了一条边。');
    setTick((n) => n + 1);
  }, [accent, muted]);

  const removeSelected = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || !selected) return;
    const cell = graph.getCellById(selected);
    if (cell) {
      graph.removeCells([cell]);
      setStatus(`已删除 ${selected}`);
    }
    setSelected(null);
    setTick((n) => n + 1);
  }, [selected]);

  const save = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const json = graph.toJSON();
    setSerialized(prettyJSON(json));
    setLoaded(JSON.stringify(json));
    setStatus(`已保存 ${json.cells.length} 个图元（graph.toJSON()）。`);
  }, []);

  const load = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || !loaded) return;
    try {
      graph.fromJSON(JSON.parse(loaded));
      setSelected(null);
      setStatus('已通过 graph.fromJSON() 还原画布。');
      setError(null);
    } catch (cause) {
      setError(`JSON 解析失败：${cause instanceof Error ? cause.message : String(cause)}`);
    }
    setTick((n) => n + 1);
  }, [loaded]);

  const snippet = useMemo(
    () =>
      [
        `const graph = new Graph({`,
        `  container,`,
        `  grid: { size: 14, type: 'dot' },`,
        `  connecting: { allowBlank: false, allowLoop: false, snap: { radius: 26 }, highlight: true },`,
        `});`,
        ``,
        `// 端口：items 声明 id，groups 提供 portMarkup 与位置`,
        `// 注意 attrs 的键就是 markup 里写的 selector 名（这里写 'circle:portBody'`,
        `// 会被 X6 当成 CSS 选择器丢给 querySelectorAll 而直接抛错）`,
        `graph.addNode({`,
        `  id, x, y, width: 168, height: 54,`,
        `  ports: {`,
        `    items: [{ id: 'in', group: 'in' }, { id: 'out', group: 'out' }],`,
        `    groups: {`,
        `      in:  { position: { name: 'left'  }, markup: [{ tagName: 'circle', selector: 'portBody', attrs: { r: 8 } }], attrs: { portBody: { fill: surface } } },`,
        `      out: { position: { name: 'right' }, markup: [{ tagName: 'circle', selector: 'portBody', attrs: { r: 8 } }], attrs: { portBody: { fill: accent } } },`,
        `    },`,
        `  },`,
        `});`,
        ``,
        `// 松开鼠标后 X6 已经建好边，我们在这里补上路由与箭头（marker 用 2.x 的内置名）`,
        `graph.on('edge:connected', ({ edge }) => {`,
        `  edge.setRouter('manhattan', { padding: 14 });`,
        `  edge.setAttrs({ line: { strokeWidth: 2, targetMarker: { name: 'block' } } });`,
        `});`,
        ``,
        `// 程序化连线`,
        `graph.addEdge({`,
        `  source: { cell: a.id, port: 'out' },`,
        `  target: { cell: b.id, port: 'in' },`,
        `  router: { name: 'manhattan' }, connector: { name: 'rounded' },`,
        `  markers: [{ name: 'block', size: 10 }],`,
        `});`,
        ``,
        `graph.toJSON();      // 保存`,
        `graph.fromJSON(json); // 载入`,
        `graph.dispose();     // 必须销毁`,
      ].join('\n'),
    [],
  );

  const reset = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.clearCells();
    setSelected(null);
    setSerialized('{}');
    setLoaded('');
    setError(null);
    setStatus('画布已清空（graph.clearCells()）。新增节点或刷新页面可重新搭建。');
    setTick((n) => n + 1);
  }, []);

  // Counts are read straight off the graph model whenever the canvas changes.
  const nodes = graphRef.current?.getNodes().length ?? 0;
  const edges = graphRef.current?.getEdges().length ?? 0;
  void tick;

  return (
    <Lab title="AntV X6 端口连线与画布持久化" badge={<span className="demo-live-badge">X6 {X6_VERSION}</span>} reset={reset}>
      <LabLayout
        controls={
          <>
            <Select<NodeKind> label="新增节点类型" value="service" options={KINDS} onChange={addNode} />
            <div className="lab-options">
              <button type="button" className="button button--secondary button--small" onClick={connectProgrammatically}>
                程序化连线
              </button>
              <button type="button" className="button button--secondary button--small" onClick={save}>
                保存 JSON
              </button>
              <button type="button" className="button button--secondary button--small" onClick={load} disabled={!loaded}>
                载入 JSON
              </button>
              <button type="button" className="button button--secondary button--small" onClick={removeSelected} disabled={!selected}>
                删除选中
              </button>
            </div>
            <Status tone={selected ? 'ok' : undefined}>
              {selected ? `当前选中：${selected}` : '未选中图元。点击节点或边即可选中。'}
            </Status>
            <Status>{status}</Status>
          </>
        }
      >
        {error ? <ErrorNote onRetry={() => setError(null)}>{error}</ErrorNote> : null}
        <div className="lab-x6-canvas" ref={hostRef} style={{ background: soft }} role="img" aria-label="X6 画布" />
        <div style={{ marginTop: 14 }}>
          <Stats>
            <Stat label="节点" value={nodes} />
            <Stat label="边" value={edges} />
            <Stat label="选中" value={selected ?? '—'} />
          </Stats>
        </div>
      </LabLayout>

      <Code text={snippet} onCopy={onCopy} label="X6 调用" />
      <div style={{ marginTop: 22 }}>
        <Code text={serialized} onCopy={onCopy} label="graph.toJSON()" maxHeight={280} />
      </div>
    </Lab>
  );
}
