import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, LabLayout, Range, Stat, Stats, Status, useAnimationFrame, useMotionOk, useStableId, useThemeColors } from '../lab-kit';

const UPLOT_VERSION = '1.6.31';
const WINDOW_MAX = 24000;

interface Cursor {
  idx: number;
  t: number;
  p50: number;
  p99: number;
}

function buildSeries(count: number, seed: number): uPlot.AlignedData {
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const x: number[] = new Array(count);
  const p50: number[] = new Array(count);
  const p99: number[] = new Array(count);
  let base = 48;
  for (let i = 0; i < count; i += 1) {
    base = Math.max(18, Math.min(160, base + (rand() - 0.5) * 2.4));
    const wave = Math.sin(i / 340) * 9 + Math.sin(i / 83) * 4;
    const spike = i % 2900 > 2860 ? 42 : 0;
    x[i] = i / 20; // 20 points per simulated second
    p50[i] = Math.round((base + wave + spike * 0.35 + rand() * 3) * 100) / 100;
    p99[i] = Math.round((base * 3.4 + wave * 2.6 + spike + rand() * 14) * 100) / 100;
  }
  return [x, p50, p99];
}

/**
 * uPlot: the point of the library is dense series in a canvas. Drag-to-zoom is
 * uPlot's own `cursor.drag.setScale`; the cursor readout comes from the
 * `setCursor` hook, and live data is pushed with `setData`.
 */
export default function UPlotLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const colors = useThemeColors();
  const hostRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const liveRef = useRef<{ x: number[]; p50: number[]; p99: number[]; t: number; seed: number }>({ x: [], p50: [], p99: [], t: 0, seed: 7 });
  const [points, setPoints] = useState(20000);
  const [live, setLive] = useState(false);
  const [drawMs, setDrawMs] = useState(0);
  const [xWindow, setWindowState] = useState({ min: 0, max: 1000 });
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [selection, setSelection] = useState<string>('未框选');
  const [error, setError] = useState<string | null>(null);
  const themeKey = useStableId('uplot');

  const ink = colors.ink ?? '#222';
  const line = colors.line ?? '#ddd';
  const accent = colors.accent ?? '#e2725b';

  const initial = useMemo(() => buildSeries(points, 20260101), [points]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    liveRef.current = { x: [...(initial[0] as number[])], p50: [...(initial[1] as number[])], p99: [...(initial[2] as number[])], t: points / 20, seed: (points * 31) >>> 0 };

    let plot: uPlot;
    try {
      plot = new uPlot(
        {
          width: Math.max(240, host.clientWidth),
          height: 280,
          padding: [12, 10, 0, 0],
          cursor: {
            drag: { x: true, y: false, setScale: true, dist: 6 },
            focus: { prox: 24 },
            points: { size: 7, width: 1 },
          },
          legend: { show: false },
          scales: { x: { time: false } },
          axes: [
            { stroke: line, grid: { stroke: line, width: 1 }, ticks: { stroke: line }, font: '11px system-ui', size: 46 },
            { stroke: line, grid: { stroke: line, width: 1 }, ticks: { stroke: line }, font: '11px system-ui', size: 54 },
          ],
          series: [
            { label: 'P50' },
            { label: 'P50', stroke: accent, width: 1.5, points: { show: true } },
            { label: 'P99', stroke: ink, width: 1, dash: [6, 4], points: { show: false } },
          ],
          hooks: {
            setCursor: [
              (self) => {
                const index = self.cursor.idx;
                if (index == null) {
                  setCursor(null);
                  return;
                }
                setCursor({
                  idx: index,
                  t: self.data[0][index] ?? 0,
                  p50: self.data[1][index] ?? 0,
                  p99: self.data[2][index] ?? 0,
                });
              },
            ],
            setSelect: [
              (self) => {
                const box = self.select;
                if (!box || box.width < 2) {
                  setSelection('未框选');
                  return;
                }
                const from = self.posToVal(box.left, 'x');
                const to = self.posToVal(box.left + box.width, 'x');
                setSelection(`拖拽区间 ${Number(from).toFixed(1)}s → ${Number(to).toFixed(1)}s（已按 setScale 缩放）`);
              },
            ],
          },
        },
        initial,
        host,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }

    plotRef.current = plot;
    setWindowState({ min: plot.scales.x.min ?? 0, max: plot.scales.x.max ?? 0 });

    const observer = new ResizeObserver(() => plot.setSize({ width: Math.max(240, host.clientWidth), height: 280 }));
    observer.observe(host);

    return () => {
      observer.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [initial, themeKey, accent, ink, line]);

  // Live tailing: append a few samples per frame and hand the whole aligned
  // array back to uPlot with setData.
  useAnimationFrame(live, (_now, dt) => {
    const plot = plotRef.current;
    if (!plot) return;
    const state = liveRef.current;
    const step = Math.max(1, Math.min(6, Math.round(dt / 16)));
    for (let i = 0; i < step; i += 1) {
      state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
      const noise = state.seed / 4294967296;
      state.t += 0.05;
      const p50 = 44 + Math.sin(state.t / 17) * 11 + noise * 6;
      const p99 = p50 * 3.6 + noise * 26;
      state.x.push(state.t);
      state.p50.push(Math.round(p50 * 100) / 100);
      state.p99.push(Math.round(p99 * 100) / 100);
    }
    if (state.x.length > WINDOW_MAX) {
      const drop = state.x.length - WINDOW_MAX;
      state.x.splice(0, drop);
      state.p50.splice(0, drop);
      state.p99.splice(0, drop);
    }
    const started = performance.now();
    plot.setData([state.x, state.p50, state.p99], false);
    setDrawMs(performance.now() - started);
    setWindowState({ min: plot.scales.x.min ?? 0, max: plot.scales.x.max ?? 0 });
  });

  const resetZoom = useCallback(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const state = liveRef.current;
    plot.setData([state.x, state.p50, state.p99], true);
    plot.setScale('x', { min: state.x[0] ?? 0, max: state.x[state.x.length - 1] ?? 1000 });
    setSelection('未框选');
    setCursor(null);
    setWindowState({ min: plot.scales.x.min ?? 0, max: plot.scales.x.max ?? 0 });
  }, []);

  const reset = () => {
    setLive(false);
    setPoints(20000);
    resetZoom();
  };

  const snippet = useMemo(
    () =>
      [
        `import uPlot from 'uplot';`,
        `import 'uplot/dist/uPlot.min.css';`,
        ``,
        `const plot = new uPlot({`,
        `  width: host.clientWidth,        // uPlot 不会自适应，必须显式给尺寸`,
        `  height: 280,`,
        `  cursor: { drag: { x: true, y: false, setScale: true, dist: 6 } },`,
        `  scales: { x: { time: false } },`,
        `  series: [{}, { label: 'P50', stroke: '#e2725b', width: 1.5 }, { label: 'P99', dash: [6,4] }],`,
        `  hooks: {`,
        `    setCursor: [(self) => { const i = self.cursor.idx; /* 读取实际数据点 */ }],`,
        `    setSelect: [(self) => { const box = self.select; /* 拖拽框选后的范围 */ }],`,
        `  },`,
        `}, [x, p50, p99], host);`,
        ``,
        `// 在画布上横向拖拽 = 真实缩放（uPlot 自己按 setScale 处理）`,
        `plot.setSize({ width: host.clientWidth, height: 280 });`,
        `plot.setData([x, p50, p99], false);   // 推送新数据`,
        `plot.destroy();`,
      ].join('\n'),
    [],
  );

  return (
    <Lab title="uPlot 高密度时序与拖拽缩放" badge={<span className="demo-live-badge">uPlot {UPLOT_VERSION}</span>} reset={reset}>
      <LabLayout
        controls={
          <>
            <Range label="初始点数" value={points} min={2000} max={40000} step={2000} onChange={(n) => { setPoints(n); setLive(false); }} hint="重新构建实例，改变初始数据量。" />
            <div className="lab-options">
              <button type="button" className="button button--primary button--small" onClick={() => setLive((v) => !v)} disabled={!motionOk && !live}>
                {live ? '暂停追加' : '实时追加'}
              </button>
              <button type="button" className="button button--secondary button--small" onClick={resetZoom}>
                重置缩放
              </button>
            </div>
            {!motionOk ? <Status tone="warn">系统开启了「减少动态效果」，实时追加默认停用，可手动开启。</Status> : null}
            <Status>{selection}</Status>
            <Status tone="ok">
              在图上横向拖拽即可缩放：uPlot 通过 <code>cursor.drag.setScale</code> 直接改写 x 轴比例尺。
            </Status>
          </>
        }
      >
        {error ? <ErrorNote onRetry={reset}>uPlot 初始化失败：{error}</ErrorNote> : null}
        <div className="lab-uplot-box" ref={hostRef} />
        <div style={{ marginTop: 14 }}>
          <Stats>
            <Stat label="当前点数" value={(liveRef.current.x.length || points).toLocaleString('zh-CN')} />
            <Stat label="x 轴窗口" value={`${xWindow.min.toFixed(0)} → ${xWindow.max.toFixed(0)}s`} />
            <Stat label="setData 实测" value={`${drawMs.toFixed(2)} ms`} />
          </Stats>
        </div>
        {cursor ? (
          <p className="lab-status" data-tone="ok">
            光标命中第 <strong>{cursor.idx.toLocaleString('zh-CN')}</strong> 个样本 · t = {cursor.t.toFixed(2)}s · P50 {cursor.p50}ms · P99 {cursor.p99}ms
          </p>
        ) : (
          <p className="lab-status">把指针移到曲线上，<code>setCursor</code> 会返回真实的样本下标与数值。</p>
        )}
      </LabLayout>

      <Code text={snippet} onCopy={onCopy} label="uPlot 调用" />
    </Lab>
  );
}
