import { LabControls } from '../lab-kit';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as paper from 'paper';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Range, Select, Stat, Stats, useThemeColors } from '../lab-kit';

type Kind = 'circle' | 'rect' | 'polygon';
type Op = 'none' | 'unite' | 'subtract' | 'intersect' | 'exclude';

const KIND_OPTIONS: readonly (readonly [Kind, string])[] = [
  ['circle', '圆形'],
  ['rect', '矩形'],
  ['polygon', '正五边形'],
];
const OP_OPTIONS: readonly (readonly [Op, string])[] = [
  ['none', '不合并'],
  ['unite', 'unite 并集'],
  ['subtract', 'subtract 差集'],
  ['intersect', 'intersect 交集'],
  ['exclude', 'exclude 异或'],
];

const LOGICAL_W = 620;
const LOGICAL_H = 340;

interface ShapeState {
  kind: Kind;
  x: number;
  y: number;
  size: number;
}

const DEFAULT_A: ShapeState = { kind: 'circle', x: 240, y: 150, size: 150 };
const DEFAULT_B: ShapeState = { kind: 'rect', x: 400, y: 200, size: 170 };

function makeShape(scope: paper.PaperScope, state: ShapeState): paper.PathItem {
  const center = new scope.Point(state.x, state.y);
  const half = state.size / 2;
  if (state.kind === 'circle') return new scope.Path.Circle(center, half);
  if (state.kind === 'polygon') return new scope.Path.RegularPolygon(center, 5, half);
  const w = state.size;
  const h = state.size * 0.78;
  return new scope.Path.Rectangle(new scope.Rectangle(state.x - w / 2, state.y - h / 2, w, h));
}

/** PathItem is a union (Path | CompoundPath); both expose `area`, only Path has `segments`. */
function pathLabel(item: paper.PathItem): string {
  const shape = item as unknown as { className: string; area: number; segments?: unknown[] };
  const segments = shape.segments ? ` · ${shape.segments.length} 段` : '';
  return `${shape.className}${segments} · ${shape.area.toFixed(0)} px²`;
}

/** Paper.js：真实布尔运算（unite/subtract/intersect/exclude），在 PaperScope 里构建 Path。 */
export default function PaperjsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scopeRef = useRef<paper.PaperScope | null>(null);
  const dragRef = useRef<'a' | 'b' | null>(null);

  const [a, setA] = useState<ShapeState>(DEFAULT_A);
  const [b, setB] = useState<ShapeState>(DEFAULT_B);
  const [op, setOp] = useState<Op>('unite');
  const [info, setInfo] = useState({ a: '—', b: '—', result: '—' });
  const [error, setError] = useState<string | null>(null);
  const [nonce] = useState(0);

  const accent = colors.accent ?? '#d95a3f';
  const line = colors['line-strong'] ?? '#cfc4bb';
  const surface = colors.surface ?? '#fffdf9';
  const ink = colors.ink ?? '#1c1b19';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scope: paper.PaperScope;
    try {
      scope = new paper.PaperScope();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(LOGICAL_W * dpr);
      canvas.height = Math.floor(LOGICAL_H * dpr);
      scope.setup(canvas);
      scope.view.viewSize = new scope.Size(LOGICAL_W, LOGICAL_H);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paper.js 初始化失败');
      return;
    }
    scopeRef.current = scope;
    setError(null);
    return () => {
      scope.project.clear();
      // PaperScope.remove() exists at runtime but is missing from paper's bundled d.ts.
      (scope as unknown as { remove?: () => void }).remove?.();
      scopeRef.current = null;
    };
  }, [nonce]);

  // Rebuild the two sources plus the boolean result on every state change.
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    scope.project.clear();

    try {
      const itemA = makeShape(scope, a);
      const itemB = makeShape(scope, b);
      itemA.fillColor = new scope.Color(surface);
      itemA.strokeColor = new scope.Color(ink);
      itemA.strokeWidth = 2;
      itemA.opacity = 0.25;
      itemB.fillColor = new scope.Color(surface);
      itemB.strokeColor = new scope.Color(line);
      itemB.strokeWidth = 2;
      itemB.opacity = 0.25;

      if (op === 'none') {
        itemA.fillColor = new scope.Color(accent);
        itemA.opacity = 0.45;
        itemB.fillColor = new scope.Color(line);
        itemB.opacity = 0.45;
        scope.view.update();
        setInfo({ a: pathLabel(itemA), b: pathLabel(itemB), result: '未执行布尔运算' });
        return;
      }

      const result = op === 'unite' ? itemA.unite(itemB) : op === 'subtract' ? itemA.subtract(itemB) : op === 'intersect' ? itemA.intersect(itemB) : itemA.exclude(itemB);
      result.fillColor = new scope.Color(accent);
      result.strokeColor = new scope.Color(accent);
      result.strokeWidth = 2;
      result.opacity = 0.55;

      scope.view.update();
      setInfo({ a: pathLabel(itemA), b: pathLabel(itemB), result: pathLabel(result) });
    } catch (err) {
      setInfo({ a: '—', b: '—', result: err instanceof Error ? err.message : '布尔运算失败' });
    }
  }, [a, b, op, accent, line, surface, ink, nonce]);

  // Dragging: pointer events update the shape state, the effect re-runs Paper.js.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const toLogical = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * LOGICAL_W,
        y: ((event.clientY - rect.top) / rect.height) * LOGICAL_H,
      };
    };
    const onDown = (event: PointerEvent) => {
      const p = toLogical(event);
      const da = (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
      const db = (p.x - b.x) ** 2 + (p.y - b.y) ** 2;
      if (Math.min(da, db) > 90 * 90) return;
      dragRef.current = da <= db ? 'a' : 'b';
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      const which = dragRef.current;
      if (!which) return;
      const p = toLogical(event);
      const patch = { x: Math.round(p.x), y: Math.round(p.y) };
      if (which === 'a') setA((prev) => ({ ...prev, ...patch }));
      else setB((prev) => ({ ...prev, ...patch }));
    };
    const onUp = (event: PointerEvent) => {
      dragRef.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [a.x, a.y, b.x, b.y]);

  const snippet = useMemo(
    () => {
      const opCall = op === 'none' ? '// 关闭' : `itemA.${op}(itemB)`;
      return [
        `import * as paper from 'paper';`,
        ``,
        `const scope = new paper.PaperScope();`,
        `scope.setup(canvas);`,
        `scope.view.viewSize = new scope.Size(${LOGICAL_W}, ${LOGICAL_H});`,
        ``,
        `const itemA = ${a.kind === 'circle' ? `new scope.Path.Circle(new scope.Point(${a.x}, ${a.y}), ${a.size / 2})` : a.kind === 'polygon' ? `new scope.Path.RegularPolygon(new scope.Point(${a.x}, ${a.y}), 5, ${a.size / 2})` : `new scope.Path.Rectangle(new scope.Rectangle(${a.x}, ${a.y}, ${a.size}, ${a.size * 0.78}))`};`,
        `const itemB = ${b.kind === 'rect' ? `new scope.Path.Rectangle(new scope.Rectangle(${b.x}, ${b.y}, ${b.size}, ${b.size * 0.78}))` : `new scope.Path.Circle(new scope.Point(${b.x}, ${b.y}), ${b.size / 2})`};`,
        ``,
        `// 真正的布尔运算，返回一条新的 PathItem`,
        `const result = ${opCall};`,
        `result.fillColor = new scope.Color(accent);`,
        ``,
        `// 卸载：清空项目并解绑 scope`,
        `scope.project.clear();`,
        `scope.remove();          // 解绑 view 与 window 监听`,
      ].join('\n');
    },
    [a, b, op],
  );

  return (
    <Lab
      title="Paper.js 布尔运算"
      badge={<span className="demo-live-badge">paper 0.12.18</span>}
      reset={() => {
        setA(DEFAULT_A);
        setB(DEFAULT_B);
        setOp('unite');
      }}
    >
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <Select<Op> label="布尔运算" value={op} options={OP_OPTIONS} onChange={setOp} />
          <Select<Kind> label="形状 A 类型" value={a.kind} options={KIND_OPTIONS} onChange={(v) => setA((p) => ({ ...p, kind: v }))} />
          <Range label="形状 A 大小" value={a.size} min={40} max={280} step={5} unit=" px" onChange={(v) => setA((p) => ({ ...p, size: v }))} />
          <Select<Kind> label="形状 B 类型" value={b.kind} options={KIND_OPTIONS} onChange={(v) => setB((p) => ({ ...p, kind: v }))} />
          <Range label="形状 B 大小" value={b.size} min={40} max={280} step={5} unit=" px" onChange={(v) => setB((p) => ({ ...p, size: v }))} />

          <p className="lab-paper-meta">直接在画布上拖动两个形状的重心，Paper.js 会重新计算布尔路径。</p>
          {error ? <p className="lab-error">{error}</p> : null}
        </LabControls>

        <div className="lab-stage">
          <div className="lab-paper-wrap">
            <canvas ref={canvasRef} className="lab-paper-canvas" aria-label="Paper.js 布尔运算画布" />
            <div>
              <p className="lab-paper-meta">
                坐标 A：{a.x}, {a.y}
              </p>
              <p className="lab-paper-meta">
                坐标 B：{b.x}, {b.y}
              </p>
            </div>
          </div>
          <div className="lab-output-stats">
            <Stats>
              <Stat label="A" value={info.a} />
              <Stat label="B" value={info.b} />
              <Stat label="结果" value={info.result} />
            </Stats>
          </div>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Paper.js 调用" maxHeight={320} />
    </Lab>
  );
}
