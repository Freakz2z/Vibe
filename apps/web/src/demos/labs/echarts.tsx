import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, LabLayout, Range, Segmented, Stat, Stats, Status, seeded, useStableId, useThemeColors } from '../lab-kit';

const ECHARTS_VERSION = (echarts as unknown as { version?: string }).version ?? '6';

type ScenarioKey = 'traffic' | 'orders' | 'latency';
type FieldKey = 'pv' | 'signup' | 'pay';

interface Row {
  day: string;
  pv: number;
  signup: number;
  pay: number;
}

interface SeriesDef {
  field: FieldKey;
  name: string;
  type: 'bar' | 'line';
  yAxisIndex: number;
}

/** One dataset source, three series read out of it via `encode`. */
const SERIES: readonly SeriesDef[] = [
  { field: 'pv', name: '浏览量', type: 'line', yAxisIndex: 0 },
  { field: 'signup', name: '注册', type: 'line', yAxisIndex: 0 },
  { field: 'pay', name: '付费订单', type: 'bar', yAxisIndex: 1 },
];

const SCENARIOS: readonly (readonly [ScenarioKey, string])[] = [
  ['traffic', '站点流量'],
  ['orders', '订单转化'],
  ['latency', '突发流量'],
];

const DAYS = 45;

function buildRows(scenario: ScenarioKey, seed: number): Row[] {
  const rand = seeded(seed);
  const rows: Row[] = [];
  let pv = 4200;
  let pay = 120;
  for (let i = 0; i < DAYS; i += 1) {
    const date = new Date(Date.UTC(2026, 7, 3 + i));
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const wave = Math.sin(i / 5) * 0.16 + Math.sin(i / 13) * 0.1;
    const drift = i / DAYS;
    if (scenario === 'traffic') {
      pv = Math.max(500, pv * (1 + (rand() - 0.47) * 0.06) + wave * 260);
      rows.push({
        day: date.toISOString().slice(0, 10),
        pv: Math.round(pv * (weekend ? 0.82 : 1)),
        signup: Math.round(pv * 0.041 * (0.7 + rand() * 0.6)),
        pay: Math.round(pv * 0.008 * (0.6 + rand() * 0.8)),
      });
    } else if (scenario === 'orders') {
      pay = Math.max(20, pay * (1 + (rand() - 0.46) * 0.12));
      const seasonal = 1 + Math.sin((i / 45) * Math.PI * 2) * 0.35;
      rows.push({
        day: date.toISOString().slice(0, 10),
        pv: Math.round((2600 + drift * 1900) * seasonal * (0.85 + rand() * 0.3)),
        signup: Math.round(pay * (0.6 + rand() * 0.5)),
        pay: Math.round(pay * (weekend ? 0.7 : 1)),
      });
    } else {
      const spike = i >= 26 && i <= 31 ? 3.4 : 1;
      rows.push({
        day: date.toISOString().slice(0, 10),
        pv: Math.round((12000 + drift * 5000) * (0.8 + rand() * 0.4)),
        signup: Math.round(40 + rand() * 30 * spike),
        pay: Math.round(8 + rand() * 6),
      });
    }
  }
  return rows;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Apache ECharts 6: one `dataset` source feeding three series via `encode`,
 * a real `dataZoom` (inside + slider), `markLine`/`markArea` annotations and a
 * `visualMap` whose maximum is recomputed from the legend-visible series.
 */
export default function EChartsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const rowsRef = useRef<Row[]>([]);
  const [scenario, setScenario] = useState<ScenarioKey>('traffic');
  const [windowPct, setWindowPct] = useState(0);
  const [visible, setVisible] = useState<number>(SERIES.length);
  const [readout, setReadout] = useState({ from: 0, to: DAYS - 1, avg: 0, samples: 0 });
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const rows = useMemo(() => buildRows(scenario, scenario === 'traffic' ? 11 : scenario === 'orders' ? 29 : 47), [scenario]);
  rowsRef.current = rows;

  const themeKey = useStableId('echarts');
  const ink = colors.ink ?? '#222';
  const muted = colors.muted ?? '#888';
  const line = colors.line ?? '#ddd';
  const accent = colors.accent ?? '#e2725b';
  const soft = colors['accent-soft'] ?? '#f6e3dc';
  const surface = colors.surface ?? '#fff';

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let chart: echarts.ECharts;
    try {
      chart = echarts.init(host, undefined, { renderer: 'canvas' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    chartRef.current = chart;
    setVisible(SERIES.length);

    const visibleMax = Math.max(...rows.flatMap((r) => SERIES.map((s) => r[s.field])));
    const peakIndex = rows.reduce((best, row, index) => (row.pv > rows[best].pv ? index : best), 0);

    chart.setOption(
      {
        animation: false,
        textStyle: { color: muted, fontFamily: 'inherit' },
        grid: { left: 8, right: 8, top: 44, bottom: 74, containLabel: true },
        legend: { top: 4, textStyle: { color: ink }, data: SERIES.map((s) => s.name) },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        dataset: {
          source: rows,
          dimensions: ['day', 'pv', 'signup', 'pay'],
        },
        xAxis: {
          type: 'category',
          axisLine: { lineStyle: { color: line } },
          axisLabel: { color: muted },
          axisTick: { show: false },
        },
        yAxis: [
          { type: 'value', max: visibleMax, splitLine: { lineStyle: { color: line } }, axisLabel: { color: muted } },
          { type: 'value', max: visibleMax, splitLine: { show: false }, axisLabel: { color: muted } },
        ],
        visualMap: {
          show: false,
          type: 'continuous',
          dimension: 1,
          min: 0,
          max: visibleMax,
          inRange: { color: [accent, soft] },
        },
        dataZoom: [
          { type: 'inside', start: windowPct, end: 100, zoomOnMouseWheel: true, moveOnMouseMove: true },
          { type: 'slider', start: windowPct, end: 100, height: 26, bottom: 14, borderColor: line, fillerColor: soft, handleStyle: { color: accent }, textStyle: { color: muted } },
        ],
        series: SERIES.map((s) => ({
          name: s.name,
          type: s.type,
          yAxisIndex: s.yAxisIndex,
          encode: { x: 'day', y: s.field },
          smooth: s.type === 'line',
          showSymbol: false,
          itemStyle: { color: s.field === 'pay' ? accent : ink, opacity: s.field === 'signup' ? 0.55 : 1 },
          lineStyle: s.type === 'line' ? { width: 2, color: s.field === 'signup' ? muted : accent } : undefined,
          areaStyle: s.field === 'pv' ? { color: soft, opacity: 0.7 } : undefined,
          markLine:
            s.field === 'signup'
              ? {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: accent, type: 'dashed', width: 1 },
                  data: [{ yAxis: mean(rows.map((r) => r.signup)), name: '注册均值' }],
                  label: { color: muted, fontSize: 10, formatter: '注册均值' },
                }
              : undefined,
          markArea:
            s.field === 'pv'
              ? {
                  silent: true,
                  itemStyle: { color: soft },
                  data: [[{ xAxis: rows[peakIndex].day }, { xAxis: rows[Math.min(peakIndex + 4, rows.length - 1)].day }]],
                  label: { show: true, color: accent, fontSize: 10, position: 'insideTop' },
                }
              : undefined,
        })),
      },
      { notMerge: true },
    );

    const syncWindow = () => {
      const option = chart.getOption() as { dataZoom?: { start?: number; end?: number; startValue?: number | string; endValue?: number | string }[] };
      const zoom = option.dataZoom?.[0];
      const from = Number(zoom?.startValue ?? 0);
      const to = Number(zoom?.endValue ?? rowsRef.current.length - 1);
      const slice = rowsRef.current.slice(from, to + 1);
      setReadout({
        from: Number.isFinite(from) ? from : 0,
        to: Number.isFinite(to) ? to : rowsRef.current.length - 1,
        avg: Math.round(mean(slice.map((r) => r.pv))),
        samples: slice.length,
      });
    };

    // Legend selection really recomputes the axis / visualMap range from the
    // series that are still visible.
    const onLegend = (params: unknown) => {
      const selected = (params as { selected?: Record<string, boolean> }).selected ?? {};
      const on = SERIES.filter((s) => selected[s.name] !== false);
      const max = on.length === 0 ? 1 : Math.max(...rows.flatMap((r) => on.map((s) => r[s.field])));
      chart.setOption({ yAxis: [{ max }, { max }], visualMap: { max } });
      setVisible(on.length);
    };

    chart.on('legendselectchanged', onLegend);
    chart.on('datazoom', syncWindow);
    syncWindow();

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);
    return () => {
      observer.disconnect();
      chart.off('legendselectchanged', onLegend);
      chart.dispose();
      chartRef.current = null;
    };
  }, [rows, windowPct, nonce, themeKey, accent, ink, line, muted, soft]);

  const jumpToPeak = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const peak = rows.reduce((best, row, index) => (row.pv > rows[best].pv ? index : best), 0);
    const half = 7;
    const from = Math.max(0, peak - half);
    const to = Math.min(rows.length - 1, peak + half);
    // Real action dispatch: dataZoom is bound to the category index axis.
    chart.dispatchAction({ type: 'dataZoom', startValue: rows[from].day, endValue: rows[to].day });
  }, [rows]);

  const reset = () => {
    setWindowPct(0);
    setScenario('traffic');
    setNonce((n) => n + 1);
  };

  const snippet = useMemo(
    () =>
      [
        `const chart = echarts.init(host);`,
        `chart.setOption({`,
        `  dataset: { source: rows, dimensions: ['day', 'pv', 'signup', 'pay'] },`,
        `  xAxis: { type: 'category' },`,
        `  series: SERIES.map(s => ({ name: s.name, type: s.type, encode: { x: 'day', y: s.field } })),`,
        `  dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 26 }],`,
        `  visualMap: { show: false, type: 'continuous', dimension: 1, max: visibleMax },`,
        `}, { notMerge: true });`,
        ``,
        `// 图例勾选后，坐标轴与 visualMap 立刻按“仍可见的系列”重算`,
        `chart.on('legendselectchanged', (p) => {`,
        `  const on = SERIES.filter(s => p.selected[s.name] !== false);`,
        `  chart.setOption({ yAxis: [{ max }, { max }], visualMap: { max } });`,
        `});`,
        ``,
        `// 把 dataZoom 窗口对齐到峰值附近（category 轴按 index 取值）`,
        `chart.dispatchAction({ type: 'dataZoom', startValue: '2026-08-20', endValue: '2026-09-03' });`,
        ``,
        `chart.dispose();`,
      ].join('\n'),
    [visible],
  );

  return (
    <Lab
      title="ECharts dataset · dataZoom · 图例联动"
      badge={<span className="demo-live-badge">ECharts {ECHARTS_VERSION}</span>}
      reset={reset}
    >
      <LabLayout
        controls={
          <>
            <Segmented<ScenarioKey> label="数据集" value={scenario} options={SCENARIOS} onChange={setScenario} />
            <Range
              label="dataZoom 起点"
              value={windowPct}
              min={0}
              max={90}
              step={1}
              unit="%"
              onChange={setWindowPct}
              hint="滑块与 inside 缩放共用同一份区间配置。"
            />
            <div className="lab-options">
              <button type="button" className="button button--primary button--small" onClick={jumpToPeak}>
                对齐峰值窗口
              </button>
            </div>
            <Status tone={visible > 0 ? 'ok' : 'warn'}>
              当前可见系列 {visible} / {SERIES.length}。点击图例取消勾选后，y 轴与 visualMap 会按剩余系列重新取值。
            </Status>
          </>
        }
      >
        {error ? <ErrorNote onRetry={reset}>ECharts 初始化失败：{error}</ErrorNote> : null}
        <div className="lab-echarts-host" ref={hostRef} role="img" aria-label="ECharts 多系列图，含 dataZoom 与 markLine" />
        <div style={{ marginTop: 14, background: surface, borderRadius: 12, padding: '2px 12px' }}>
          <Stats>
            <Stat label="窗口内样本" value={`${readout.samples} 天`} />
            <Stat label="索引区间" value={`${readout.from}–${readout.to}`} />
            <Stat label="窗口内 PV 均值" value={readout.avg.toLocaleString('zh-CN')} />
          </Stats>
        </div>
      </LabLayout>

      <Code text={snippet} onCopy={onCopy} label="ECharts 调用" />
    </Lab>
  );
}
