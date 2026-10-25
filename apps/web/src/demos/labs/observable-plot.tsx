import { useEffect, useMemo, useRef, useState } from 'react';
import * as Plot from '@observablehq/plot';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Range, Segmented, Stat, Stats, Status, useStableId, useThemeColors } from '../lab-kit';

const PLOT_VERSION = '0.6.16';
type BinMode = 'equal' | 'quantile' | 'sqrt';

const BIN_MODES: readonly (readonly [BinMode, string])[] = [
  ['equal', '等宽'],
  ['quantile', '分位数'],
  ['sqrt', '平方根'],
];

interface Sample {
  score: number;
  group: '新客' | '回流' | '会员';
}

const GROUPS: Sample['group'][] = ['新客', '回流', '会员'];

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

/** Deterministic sample set: three skewed populations, no runtime randomness. */
function buildSamples(count: number): Sample[] {
  const out: Sample[] = [];
  let s = 20260919 >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    const group = GROUPS[i % GROUPS.length];
    const base = group === '新客' ? 34 : group === '回流' ? 58 : 76;
    const spread = group === '新客' ? 20 : group === '回流' ? 24 : 15;
    const value = Math.min(100, Math.max(0, base + (next() + next() + next() - 1.5) * spread * 1.6));
    out.push({ score: Math.round(value * 10) / 10, group });
  }
  return out;
}

interface BinRow {
  x1: number;
  x2: number;
  count: number;
}

/** Plot 的 thresholds 回调签名：拿到全部取值与实际值域，返回内部边界数组。 */
type ThresholdFn = (values: number[], min: number, max: number) => number[];

/**
 * Observable Plot 0.6: the distinguishing capability is the transform/mark
 * split. One `Plot.binX` transform is reused by `rectY`, `lineY` and `dot`.
 */
export default function ObservablePlotLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const hostRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(600);
  const [bins, setBins] = useState(12);
  const [mode, setMode] = useState<BinMode>('equal');
  const [width, setWidth] = useState(640);
  const [error, setError] = useState<string | null>(null);
  const themeKey = useStableId('plot');

  const ink = colors.ink ?? '#222';
  const muted = colors.muted ?? '#888';
  const line = colors.line ?? '#ddd';
  const accent = colors.accent ?? '#e2725b';
  const surface = colors.surface ?? '#fff';

  const data = useMemo(() => buildSamples(count), [count]);

  /**
   * Plot 的 thresholds 契约：函数形式会拿到 (values, min, max) 并返回内部边界数组。
   * 统一返回数组（而不是数字个数），这样我们和 Plot 用的是同一套边界。
   */
  const thresholds = useMemo<ThresholdFn>(() => {
    if (mode === 'quantile') {
      return (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        return Array.from({ length: Math.max(1, bins - 1) }, (_, i) => quantile(sorted, (i + 1) / bins));
      };
    }
    if (mode === 'sqrt') {
      return (_values, min, max) =>
        Array.from({ length: Math.max(1, bins - 1) }, (_, i) => {
          const t = (i + 1) / bins;
          return min + (max - min) * Math.sqrt(t);
        });
    }
    return (_values, min, max) =>
      Array.from({ length: Math.max(1, bins - 1) }, (_, i) => min + (max - min) * ((i + 1) / bins));
  }, [mode, bins]);

  /**
   * 交给 Plot 的只有内部边界（首尾两档由 Plot 自己用数据范围补上），
   * 这里显式补齐成完整的箱边界数组：edges[0] = min，edges[last] = max，
   * 于是所有样本都落在 [min, max] 内、不会被 Plot 丢弃。
   */
  const edges = useMemo(() => {
    const scores = data.map((d) => d.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    // 退化数据（全部相等）时给一个单位宽的箱，保证至少有一档。
    if (!(max > min)) return [min, min + 1];
    const inner = thresholds(scores, min, max).filter((t) => Number.isFinite(t) && t > min && t < max);
    return [min, ...inner, max];
  }, [data, thresholds]);

  /** Plot 真正使用的内部边界。 */
  const innerThresholds = useMemo(() => edges.slice(1, -1), [edges]);

  /**
   * binX 的实际输出：`transform(data, facets, {})` 返回的是**分箱后的分组**，
   * 每一项是一箱里的原始样本数组（identity reduce），不是 {x1, x2, count} 记录。
   * 箱边界只能由我们自己那套 edges 还原——Plot 的默认 filter 会丢掉空箱，
   * 这里的 count > 0 过滤与之保持一致。
   */
  const binRows = useMemo<BinRow[]>(() => {
    const scores = data.map((d) => d.score);
    const rows: BinRow[] = [];
    for (let i = 0; i < edges.length - 1; i += 1) {
      const x1 = edges[i];
      const x2 = edges[i + 1];
      const last = i === edges.length - 2;
      let count = 0;
      for (const value of scores) {
        if (value >= x1 && (last ? value <= x2 : value < x2)) count += 1;
      }
      if (count > 0) rows.push({ x1, x2, count });
    }
    return rows;
  }, [data, edges]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const rendered: (SVGSVGElement | HTMLElement)[] = [];
    try {
      const mean = data.reduce((a, d) => a + d.score, 0) / Math.max(1, data.length);
      const color = { type: 'ordinal' as const, range: [accent, ink, muted] };

      const transform = Plot.binX({ y: 'count' }, { x: 'score', thresholds: innerThresholds });

      const axis = { color: muted, opacity: 0.95, fontSize: 11 };

      const histogram = Plot.plot({
        width,
        height: 190,
        marginLeft: 46,
        marginBottom: 34,
        style: { background: surface, color: muted, fontSize: '11px', overflow: 'visible' },
        color,
        x: { label: '体验评分', ...axis },
        y: { label: '样本数', ...axis },
        marks: [
          Plot.rectY(data, { ...transform, fill: 'group', opacity: 0.9, rx: 1 }),
          Plot.ruleX([mean], { stroke: ink, strokeDasharray: '4 3', strokeWidth: 1.2 }),
        ],
      });

      const strip = Plot.plot({
        width,
        height: 84,
        marginLeft: 46,
        marginTop: 6,
        marginBottom: 26,
        style: { background: surface, color: muted, fontSize: '11px', overflow: 'visible' },
        color,
        x: { label: null, ...axis },
        marks: [Plot.dot(data, { x: 'score', y: () => 0.5, r: 2.6, fill: 'group' })],
      });

      const polyline = Plot.plot({
        width,
        height: 120,
        marginLeft: 46,
        marginBottom: 30,
        style: { background: surface, color: muted, fontSize: '11px', overflow: 'visible' },
        color,
        x: { label: '分箱边界', ...axis },
        y: { label: '同一次分箱', ...axis },
        marks: [
          Plot.ruleY([0], { stroke: line }),
          Plot.lineY(data, { ...transform, stroke: accent, strokeWidth: 2, curve: 'step-after' }),
        ],
      });

      for (const node of [histogram, strip, polyline]) {
        host.appendChild(node);
        rendered.push(node);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
    return () => {
      for (const node of rendered) node.remove();
    };
  }, [data, innerThresholds, width, themeKey, accent, ink, line, muted, surface]);

  // Plot has no built-in resize: re-render when the container width really changes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setWidth(Math.max(220, Math.round(host.clientWidth)));
    measure();
    let last = host.clientWidth;
    const observer = new ResizeObserver(() => {
      const next = host.clientWidth;
      if (Math.abs(next - last) < 8) return;
      last = next;
      measure();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const reset = () => {
    setMode('equal');
    setBins(12);
    setCount(600);
  };

  const total = binRows.reduce((a, r) => a + r.count, 0);
  const mean = data.reduce((a, d) => a + d.score, 0) / Math.max(1, data.length);

  const snippet = useMemo(
    () =>
      [
        `// 一次分箱，三个标记复用同一个 transform`,
        `const transform = Plot.binX({ y: 'count' }, { x: 'score', thresholds });`,
        ``,
        `Plot.rectY(data, { ...transform, fill: 'group' });   // 直方图`,
        `Plot.lineY(data, { ...transform, curve: 'step-after' }); // 阶梯折线`,
        `Plot.ruleX([${mean.toFixed(1)}], { strokeDasharray: '4 3' }); // 评分均值参考线`,
        `Plot.dot(data, { x: 'score', sw: 8, r: 2.4 });        // 底部样本带`,
        ``,
        `// thresholds 接受“分箱个数”、阈值数组，或自定义函数：`,
        `thresholds: (values) => Array.from({ length: ${Math.max(0, bins - 1)} }, (_, i) =>`,
        `  d3.quantile(sorted, (i + 1) / ${bins}));`,
        ``,
        `const applied = transform.transform(data, facets, {});`,
        `node.remove();   // 必须手动移除渲染结果`,
      ].join('\n'),
    [bins, mean],
  );

  return (
    <Lab title="Observable Plot 分箱变换" badge={<span className="demo-live-badge">Plot {PLOT_VERSION}</span>} reset={reset}>
      <LabLayout
        controls={
          <>
            <div data-lab-actions><Segmented<BinMode> label="分箱策略" value={mode} options={BIN_MODES} onChange={setMode} /></div>
            <Range label="分箱数量" value={bins} min={3} max={40} step={1} onChange={setBins} hint="传给 Plot.binX 的 thresholds。" />
            <Range label="样本量" value={count} min={60} max={2400} step={60} onChange={setCount} hint="数据量由确定性种子生成，不含运行时随机。" />
            <Status tone={total === data.length ? 'ok' : 'warn'}>
              transform 实际分出 {binRows.length} 箱，计数合计 {total} / {data.length}。
            </Status>
          </>
        }
      >
        {error ? <ErrorNote onRetry={reset}>Plot 渲染失败：{error}</ErrorNote> : null}
        <div className="lab-plot-host" ref={hostRef} />
        <div style={{ marginTop: 14 }}>
          <Stats>
            <Stat label="箱数" value={binRows.length} />
            <Stat label="样本均值" value={mean.toFixed(1)} />
            <Stat label="峰值箱" value={Math.max(0, ...binRows.map((r) => r.count))} />
          </Stats>
        </div>
      </LabLayout>

      <div style={{ marginTop: 22 }}>
        <DataTable
          head={['区间起点', '区间终点', '宽度', '计数']}
          rows={binRows.slice(0, 12).map((r) => [r.x1.toFixed(1), r.x2.toFixed(1), (r.x2 - r.x1).toFixed(1), String(r.count)])}
          caption={`Plot.binX transform 的实际输出（前 12 箱，共 ${binRows.length} 箱）`}
        />
      </div>

      <Code text={snippet} onCopy={onCopy} label="Observable Plot 调用" />
    </Lab>
  );
}
