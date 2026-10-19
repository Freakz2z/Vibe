import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, Lab, LabLayout, Status, useThemeColors } from '../lab-kit';

const REACT_FLOW_VERSION = '12.3.5';

type StageNode = Node<{ label: string; stage: string }, 'stage'>;

interface Stage {
  id: string;
  label: string;
  stage: string;
}

const STAGES: Stage[] = [
  { id: 'collect', label: '日志采集', stage: '采集' },
  { id: 'clean', label: '清洗去重', stage: '处理' },
  { id: 'enrich', label: '特征补全', stage: '处理' },
  { id: 'split', label: '训练/验证切分', stage: '建模' },
  { id: 'train', label: '模型训练', stage: '建模' },
  { id: 'eval', label: '离线评估', stage: '评估' },
  { id: 'gate', label: '上线门禁', stage: '发布' },
  { id: 'serve', label: '在线推理', stage: '发布' },
];

const PAIRS: [string, string][] = [
  ['collect', 'clean'],
  ['clean', 'enrich'],
  ['enrich', 'split'],
  ['split', 'train'],
  ['split', 'gate'],
  ['train', 'eval'],
  ['eval', 'gate'],
  ['gate', 'serve'],
];

function makeNodes(): StageNode[] {
  return STAGES.map((s, i) => ({
    id: s.id,
    type: 'stage',
    position: { x: (i % 4) * 210 + 20, y: Math.floor(i / 4) * 120 + 20 },
    data: { label: s.label, stage: s.stage },
  }));
}

function makeEdges(): Edge[] {
  return PAIRS.map(([source, target], i) => ({ id: `e${i}`, source, target }));
}

function StageBox({ data }: { data: StageNode['data'] }) {
  return (
    <div className="lab-rf-node" data-stage={data.stage}>
      <Handle type="target" position={Position.Left} />
      <span className="lab-rf-node__stage">{data.stage}</span>
      <strong>{data.label}</strong>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const NODE_TYPES = { stage: StageBox };

/** Kahn topological order + longest-path depth. Deterministic, no library call. */
function topo(nodes: StageNode[], edges: Edge[]): { order: string[]; depth: Map<string, number> } {
  const indegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const out = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (!indegree.has(e.source) || !indegree.has(e.target)) continue;
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    out.get(e.source)?.push(e.target);
  }
  const queue = nodes.map((n) => n.id).filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of out.get(id) ?? []) {
      depth.set(next, Math.max(depth.get(next) ?? 0, (depth.get(id) ?? 0) + 1));
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  if (order.length < nodes.length) {
    for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  }
  return { order, depth };
}

/**
 * React Flow 12: nodes are real React components, edges come from
 * `onConnect` -> `addEdge`, and the layout step below is a genuine
 * topological longest-path computation over the live graph.
 */
export default function ReactFlowLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const [nodes, setNodes, onNodesChange] = useNodesState<StageNode>(makeNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(makeEdges());
  const [status, setStatus] = useState('拖动节点位置，或从右侧圆点拖到另一个节点左侧圆点建立连接。');

  const ink = colors.ink ?? '#222';
  const muted = colors.muted ?? '#888';
  const line = colors.line ?? '#ddd';
  const accent = colors.accent ?? '#e2725b';
  const soft = colors['accent-soft'] ?? '#f6e3dc';
  const surface = colors.surface ?? '#fff';

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => addEdge({ ...connection, animated: false, style: { stroke: accent, strokeWidth: 2 } }, current));
      setStatus(`addEdge() 新增 ${connection.source} → ${connection.target}`);
    },
    [setEdges, accent],
  );

  const relayout = useCallback(() => {
    const { depth } = topo(nodes, edges);
    const lanes = new Map<number, number>();
    setNodes((current) =>
      current.map((node) => {
        const level = depth.get(node.id) ?? 0;
        const lane = lanes.get(level) ?? 0;
        lanes.set(level, lane + 1);
        return { ...node, position: { x: level * 230 + 20, y: lane * 110 + 24 } };
      }),
    );
    setStatus('已按拓扑最长路径层级重排节点（Kahn + depth 计算）。');
  }, [nodes, edges, setNodes]);

  const scramble = useCallback(() => {
    setNodes((current) =>
      current.map((node, i) => ({
        ...node,
        position: { x: 20 + ((i * 97) % 420), y: 20 + ((i * 151) % 220) },
      })),
    );
    setStatus('节点位置已打乱，可点击「拓扑重排」再算一次。');
  }, [setNodes]);

  const addStep = useCallback(() => {
    const id = `extra-${nodes.length}`;
    setNodes((current) => [
      ...current,
      { id, type: 'stage', position: { x: 40 + current.length * 30, y: 240 }, data: { label: '人工复核', stage: '评估' } },
    ]);
    setStatus(`新增节点 ${id}（未接入任何边，拓扑排序会把它放在最后）。`);
  }, [nodes.length, setNodes]);

  const analysis = useMemo(() => {
    const { order, depth } = topo(nodes, edges);
    return {
      order,
      rows: order.map((id, index) => {
        const node = nodes.find((n) => n.id === id);
        return [String(index + 1), node?.data.label ?? id, node?.data.stage ?? '—', String(depth.get(id) ?? 0)];
      }),
    };
  }, [nodes, edges]);

  const snippet = useMemo(
    () =>
      [
        `const [nodes, setNodes, onNodesChange] = useNodesState<StageNode>(initialNodes);`,
        `const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);`,
        ``,
        `const onConnect = useCallback((connection: Connection) => {`,
        `  setEdges((eds) => addEdge({ ...connection }, eds));   // 官方唯一推荐的接线方式`,
        `}, [setEdges]);`,
        ``,
        `<ReactFlow nodes={nodes} edges={edges}`,
        `  onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>`,
        `  <Background gap={16} />`,
        `  <Controls />`,
        `  <MiniMap pannable zoomable />`,
        `  {nodes.map((n) => <StageBox key={n.id} data={n.data} />)}`,
        `</ReactFlow>;`,
        ``,
        `// 自定义节点里的 Handle 就是连线的锚点`,
        `function StageBox({ data }) {`,
        `  return <div><Handle type="target" position={Position.Left} />`,
        `    <strong>{data.label}</strong>`,
        `    <Handle type="source" position={Position.Right} /></div>;`,
        `}`,
        ``,
        `// 布局步骤：Kahn 拓扑排序 + 最长路径层级`,
        `const { depth } = topo(nodes, edges);`,
        `position: { x: depth.get(node.id) * 230, y: lane * 110 }`,
      ].join('\n'),
    [],
  );

  return (
    <Lab
      title="React Flow 节点连线与拓扑布局"
      badge={<span className="demo-live-badge">React Flow {REACT_FLOW_VERSION}</span>}
      reset={() => {
        setNodes(makeNodes());
        setEdges(makeEdges());
        setStatus('已重置为初始流水线。');
      }}
    >
      <LabLayout
        controls={
          <>
            <div className="lab-options">
              <button type="button" className="button button--primary button--small" onClick={relayout}>
                拓扑重排
              </button>
              <button type="button" className="button button--secondary button--small" onClick={scramble}>
                打乱位置
              </button>
              <button type="button" className="button button--secondary button--small" onClick={addStep}>
                新增孤立节点
              </button>
            </div>
            <Status tone="ok">{status}</Status>
            <Status>
              拓扑序长度 {analysis.order.length}，最深层级 {Math.max(0, ...analysis.rows.map((r) => Number(r[3])))}。
            </Status>
          </>
        }
      >
        <div className="lab-rf-wrap">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            defaultEdgeOptions={{ style: { stroke: line, strokeWidth: 2 } }}
            fitView
            proOptions={{ hideAttribution: false }}
            nodesDraggable
            nodesConnectable
          >
            <Background gap={16} color={line} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={() => accent} maskColor={soft} style={{ background: surface }} />
          </ReactFlow>
        </div>
        <p className="lab-mermaid-note" style={{ color: muted, marginTop: 12 }}>
          节点边框与配色继承站点 CSS 变量（{ink} / {accent}），在深浅色主题下都会跟着切换。
        </p>
      </LabLayout>

      <div style={{ marginTop: 22 }}>
        <DataTable head={['#', '节点', '阶段', '拓扑层级']} rows={analysis.rows} caption="Kahn 拓扑排序 + 最长路径层级（实时计算）" />
      </div>

      <Code text={snippet} onCopy={onCopy} label="React Flow 调用" />
    </Lab>
  );
}
