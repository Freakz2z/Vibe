import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import type { ChartConfiguration, ChartType } from 'chart.js';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, LabLayout, Range, Segmented, Stat, Stats, Status, useStableId, useThemeColors } from '../lab-kit';

const CHARTJS_VERSION = '4.4.6';

type Mode = 'single' | 'mixed' | 'radar';

const MODES: readonly (readonly [Mode, string])[] = [
  ['single', '折线 / 柱状'],
  ['mixed', '混合双轴'],
  ['radar', '雷达'],
];

interface Point {
  label: string;
  value: number;
  baseline: number;
  share: number;
}

const CHANNELS = ['搜索', '推荐', '信息流', '社区', '直播', '会员', '企业号', '开放平台'];
const AXES = ['易用性', '性能', '文档', '生态', '稳定性'];

function buildData(seedShift: number): Point[] {
  const base = [128, 96, 143, 61, 47, 88, 35, 72];
  return CHANNELS.map((label, i) => {
    const jitter = ((i * 37 + seedShift * 13) % 23) - 11;
    const value = base[i] + jitter;
    return {
      label,
      value,
      baseline: Math.round(value * (0.55 + ((i * 7 + seedShift) % 5) * 0.06)),
      share: Math.max(4, Math.round((value / base.reduce((a, b) => a + b, 0)) * 400)),
    };
  });
}

function radarRows(data: Point[], seedShift: number): Point[] {
  return AXES.map((label, i) => {
    const src = data[(i + seedShift) % data.length];
    return { label, value: 40 + ((src.value * 3 + i * 17) % 55), baseline: 35 + ((src.baseline * 2 + i * 9) % 45), share: 0 };
  });
}

/**
 * Chart.js 4: one real `Chart` instance on a canvas, dataset switching,
 * a mixed bar+line configuration with two y-axes, and hover driven interaction.
 */
export default function ChartJsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [mode, setMode] = useState<Mode>('single');
  const [shape, setShape] = useState<'line' | 'bar'>('line');
  const [seedShift, setSeedShift] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [hidden, setHidden] = useState<string[]>([]);
  const [elements, setElements] = useState(0);
  const [pngBytes, setPngBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const themeKey = useStableId('chartjs');

  const ink = colors.ink ?? '#222';
  const muted = colors.muted ?? '#888';
  const line = colors.line ?? '#ddd';
  const accent = colors.accent ?? '#e2725b';
  const soft = colors['accent-soft'] ?? '#f6e3dc';
  const surface = colors.surface ?? '#fff';
  const seriesColor = colors['accent-strong'] ?? accent;

  const data = useMemo(() => buildData(seedShift), [seedShift]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const labels = mode === 'radar' ? AXES : CHANNELS;
    const points = mode === 'radar' ? radarRows(data, seedShift) : data;

    const baseDatasets: ChartConfiguration['data']['datasets'] = [];
    if (mode === 'radar') {
      baseDatasets.push(
        {
          label: '本期评分',
          data: points.map((p) => p.value),
          borderColor: seriesColor,
          backgroundColor: soft,
          pointBackgroundColor: seriesColor,
          borderWidth: 2,
        },
        {
          label: '上期评分',
          data: points.map((p) => p.baseline),
          borderColor: muted,
          backgroundColor: 'transparent',
          pointBackgroundColor: muted,
          borderDash: [5, 4],
          borderWidth: 1.5,
        },
      );
    } else if (mode === 'mixed') {
      // Bar on the left axis, line on the right axis — the real mixed config.
      baseDatasets.push(
        {
          type: 'bar',
          label: '访问量',
          data: points.map((p) => p.value),
          yAxisID: 'y',
          backgroundColor: soft,
          borderColor: seriesColor,
          borderWidth: 1,
          borderRadius: 4,
          order: 2,
        },
        {
          type: 'line',
          label: '转化率 %',
          data: points.map((p) => p.share),
          yAxisID: 'y1',
          borderColor: accent,
          backgroundColor: accent,
          tension: 0.35,
          pointRadius: 3,
          borderWidth: 2,
          order: 1,
        },
      );
    } else {
      baseDatasets.push(
        {
          type: shape,
          label: '访问量',
          data: points.map((p) => p.value),
          borderColor: accent,
          backgroundColor: shape === 'bar' ? soft : 'transparent',
          borderWidth: shape === 'bar' ? 1 : 2,
          borderRadius: shape === 'bar' ? 4 : 0,
          tension: shape === 'line' ? 0.3 : 0,
          fill: false,
        },
        {
          type: shape,
          label: '上周同期',
          data: points.map((p) => p.baseline),
          borderColor: muted,
          backgroundColor: 'transparent',
          borderWidth: shape === 'bar' ? 1 : 1.5,
          borderDash: shape === 'line' ? [5, 4] : [],
          borderRadius: shape === 'bar' ? 4 : 0,
          fill: false,
        },
      );
    }

    const topType: ChartType = mode === 'radar' ? 'radar' : mode === 'mixed' ? 'bar' : shape;
    const config: ChartConfiguration = {
      type: topType,
      data: { labels, datasets: baseDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: ink, usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            backgroundColor: surface,
            titleColor: ink,
            bodyColor: muted,
            borderColor: line,
            borderWidth: 1,
            padding: 10,
          },
        },
        scales:
          mode === 'radar'
            ? { r: { grid: { color: line }, angleLines: { color: line }, pointLabels: { color: muted }, ticks: { color: muted, backdropColor: 'transparent' } } }
            : {
                x: { grid: { display: false }, ticks: { color: muted }, border: { color: line } },
                y: {
                  beginAtZero: true,
                  grid: { color: line },
                  ticks: { color: muted },
                  border: { color: line },
                  title: mode === 'mixed' ? { display: true, text: '访问量', color: muted } : undefined,
                },
                ...(mode === 'mixed'
                  ? {
                      y1: {
                        position: 'right' as const,
                        beginAtZero: true,
                        grid: { drawOnChartArea: false },
                        ticks: { color: muted },
                        border: { color: line },
                        title: { display: true, text: '转化率 %', color: muted },
                      },
                    }
                  : {}),
              },
        onHover: (_event, elements) => setHovered(elements.length),
      },
    };

    let chart: Chart;
    try {
      chart = new Chart(canvas, config);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    chartRef.current = chart;
    setElements(chart.getDatasetMeta(0).data.length);
    setHovered(0);

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [mode, shape, seedShift, themeKey, accent, ink, line, muted, seriesColor, soft, surface, data]);

  // Dataset visibility is a real Chart.js call, not local state.
  const toggleDataset = useCallback(
    (index: number) => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.setDatasetVisibility(index, !chart.isDatasetVisible(index));
      chart.update('none');
      setHidden(chart.data.datasets.map((_, i) => (chart.isDatasetVisible(i) ? '' : String(i))).filter(Boolean));
    },
    [],
  );

  const exportPng = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const url = chart.toBase64Image('image/png', 1);
    setPngBytes(Math.round((url.length - url.indexOf(',') - 1) * 0.75));
  }, []);

  const reset = () => {
    setMode('single');
    setShape('line');
    setSeedShift(0);
    setHidden([]);
    setPngBytes(0);
    const chart = chartRef.current;
    if (chart) chart.data.datasets.forEach((_, i) => chart.setDatasetVisibility(i, true));
  };

  const snippet = useMemo(
    () =>
      [
        `import Chart from 'chart.js/auto';            // 自动注册所有控制器`,
        ``,
        `const config: ChartConfiguration = {`,
        `  type: ${mode === 'radar' ? "'radar'" : mode === 'mixed' ? "'bar'" : `'${shape}'`},`,
        `  data: {`,
        `    labels: ${JSON.stringify((mode === 'radar' ? AXES : CHANNELS).slice(0, 4))},`,
        `    datasets: [`,
        `      { type: 'bar',  label: '访问量',   data, yAxisID: 'y'  },`,
        `      { type: 'line', label: '转化率 %', data, yAxisID: 'y1' },`,
        `    ],`,
        `  },`,
        `  options: {`,
        `    interaction: { mode: 'index', intersect: false },`,
        `    onHover: (_e, elements) => setHovered(elements.length),`,
        `  },`,
        `};`,
        ``,
        `const chart = new Chart(canvas, config);`,
        `chart.setDatasetVisibility(0, false);   // 隐藏某个数据集`,
        `chart.update('none');`,
        `const png = chart.toBase64Image();       // 真实导出位图`,
        `chart.destroy();                        // 必须销毁，绑定的事件与动画都会留着`,
      ].join('\n'),
    [mode, shape],
  );

  const datasetLabels = mode === 'radar' ? ['本期评分', '上期评分'] : mode === 'mixed' ? ['访问量', '转化率 %'] : ['访问量', '上周同期'];

  return (
    <Lab title="Chart.js 混合图与数据集切换" badge={<span className="demo-live-badge">Chart.js {CHARTJS_VERSION}</span>} reset={reset}>
      <LabLayout
        controls={
          <>
            <Segmented<Mode> label="图表配置" value={mode} options={MODES} onChange={setMode} />
            {mode === 'single' ? (
              <Segmented<'line' | 'bar'> label="几何形状" value={shape} options={[['line', '折线'], ['bar', '柱状']]} onChange={setShape} />
            ) : null}
            <Range label="数据偏移" value={seedShift} min={0} max={6} step={1} onChange={setSeedShift} hint="改变数据后用 chart.update 重绘同一实例。" />
            <div className="lab-options">
              {datasetLabels.map((label, index) => (
                <button key={label} type="button" className="button button--secondary button--small" onClick={() => toggleDataset(index)}>
                  {hidden.includes(String(index)) ? `显示 ${label}` : `隐藏 ${label}`}
                </button>
              ))}
              <button type="button" className="button button--secondary button--small" onClick={exportPng}>
                导出 PNG
              </button>
            </div>
            <Status tone={hovered > 0 ? 'ok' : undefined}>
              指针悬停命中 {hovered} 个图元；tooltip 采用 index 模式联动同一 x 轴上的全部数据集。
            </Status>
          </>
        }
      >
        {error ? <ErrorNote onRetry={reset}>Chart.js 初始化失败：{error}</ErrorNote> : null}
        <div className="lab-chartjs-wrap">
          <canvas ref={canvasRef} role="img" aria-label="Chart.js 图表" />
        </div>
        <div style={{ marginTop: 14 }}>
          <Stats>
            <Stat label="主数据集图元" value={elements} />
            <Stat label="悬停命中" value={hovered} />
            <Stat label="导出位图" value={pngBytes > 0 ? `${(pngBytes / 1024).toFixed(1)} KB` : '未导出'} />
          </Stats>
        </div>
      </LabLayout>

      <Code text={snippet} onCopy={onCopy} label="Chart.js 调用" />
    </Lab>
  );
}
