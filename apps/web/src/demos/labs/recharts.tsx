import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, Lab, LabLayout, Range, Segmented, Stat, Stats, Status, useThemeColors } from '../lab-kit';

const RECHARTS_VERSION = '2.13.3';
type Metric = 'all' | 'revenue';

const METRICS: readonly (readonly [Metric, string])[] = [
  ['all', '浏览 + 转化'],
  ['revenue', '仅金额'],
];

interface Row {
  name: string;
  views: number;
  orders: number;
  amount: number;
}

function buildRows(): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < 40; i += 1) {
    const wave = Math.sin(i / 4) * 0.3 + Math.sin(i / 11) * 0.18;
    const views = Math.round(2400 + i * 46 + wave * 1400);
    const orders = Math.round(views * (0.03 + (i % 7) * 0.0016));
    rows.push({ name: `D${String(i + 1).padStart(2, '0')}`, views, orders, amount: Math.round(orders * (58 + (i % 5) * 11)) });
  }
  return rows;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Recharts' distinguishing feature is the declarative chart tree. Here the
 * `<Brush>` is the driver: dragging it re-slice the data that every other
 * chart in the tree renders from.
 */
export default function RechartsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const rows = useMemo(buildRows, []);
  const [metric, setMetric] = useState<Metric>('all');
  const [range, setRange] = useState({ start: 0, end: rows.length - 1 });

  const ink = colors.ink ?? '#222';
  const muted = colors.muted ?? '#888';
  const line = colors.line ?? '#ddd';
  const accent = colors.accent ?? '#e2725b';
  const soft = colors['accent-soft'] ?? '#f6e3dc';
  const surface = colors.surface ?? '#fff';
  const series = colors['accent-strong'] ?? accent;

  const subset = useMemo(() => rows.slice(range.start, range.end + 1), [rows, range]);
  const avgViews = mean(subset.map((r) => r.views));
  const avgAmount = mean(subset.map((r) => r.amount));
  const totalAmount = subset.reduce((a, r) => a + r.amount, 0);
  const reference = metric === 'revenue' ? Math.round(avgAmount) : Math.round(avgViews);
  const referenceLabel = metric === 'revenue' ? '区间金额均值' : '区间浏览均值';

  const tooltipStyle = useMemo(
    () => ({ backgroundColor: surface, border: `1px solid ${line}`, borderRadius: 8, color: ink, fontSize: 12 }),
    [surface, line, ink],
  );

  const reset = () => {
    setRange({ start: 0, end: rows.length - 1 });
    setMetric('all');
  };

  const snippet = useMemo(
    () =>
      [
        `<Brush dataKey="name" height={30} travellerWidth={10}`,
        `  startIndex={range.start} endIndex={range.end}`,
        `  onChange={({ startIndex, endIndex }) => setRange({ start: startIndex, end: endIndex })} />`,
        ``,
        `// 画布被 Brush 切出的区间重新切片，下面所有图表共享同一份 subset`,
        `const subset = rows.slice(range.start, range.end + 1);`,
        ``,
        `<ComposedChart data={subset}>`,
        `  <CartesianGrid stroke={line} strokeDasharray="3 3" />`,
        `  <XAxis dataKey="name" stroke={muted} />`,
        `  <YAxis stroke={muted} />`,
        `  <Tooltip contentStyle={tooltipStyle} />`,
        `  <ReferenceLine y={${reference}} stroke={accent} strokeDasharray="5 4" label={{ value: '${referenceLabel}', fill: '${muted}' }} />`,
        `  <Bar dataKey="views" fill={soft} stroke={series} radius={[4,4,0,0]} />`,
        `  <Line type="monotone" dataKey="orders" stroke={accent} dot={false} strokeWidth={2} />`,
        `  <Legend />`,
        `</ComposedChart>`,
      ].join('\n'),
    [range.start, range.end, reference, referenceLabel, line, muted, accent, soft, series],
  );

  const rowsPreview = subset.slice(-6).map((r) => [r.name, r.views.toLocaleString('zh-CN'), String(r.orders), r.amount.toLocaleString('zh-CN')]);

  return (
    <Lab title="Recharts Brush 联动切片" badge={<span className="demo-live-badge">Recharts {RECHARTS_VERSION}</span>} reset={reset}>
      <LabLayout
        controls={
          <>
            <div data-lab-actions><Segmented<Metric> label="副轴指标" value={metric} options={METRICS} onChange={setMetric} /></div>
            <Range
              label="区间起点"
              value={range.start}
              min={0}
              max={Math.max(1, rows.length - 2)}
              step={1}
              onChange={(start) => setRange((prev) => ({ start: Math.min(start, prev.end), end: prev.end }))}
              hint="与下方 Brush 的滑块双向同步。"
            />
            <Status tone={subset.length < rows.length ? 'ok' : undefined}>
              Brush 当前选中 {subset.length} / {rows.length} 条（{rows[range.start]?.name} → {rows[range.end]?.name}）。
            </Status>
          </>
        }
      >
        <div className="lab-recharts-main">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={subset} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke={muted} tick={{ fontSize: 11 }} minTickGap={14} />
              <YAxis yAxisId="views" stroke={muted} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="money" orientation="right" stroke={muted} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: muted }} />
              <ReferenceLine
                yAxisId={metric === 'revenue' ? 'money' : 'views'}
                y={reference}
                stroke={accent}
                strokeDasharray="5 4"
                label={{ value: referenceLabel, fill: muted, fontSize: 11, position: 'insideTopRight' }}
              />
              {metric === 'all' ? <Bar isAnimationActive={false} yAxisId="views" dataKey="views" name="浏览量" fill={soft} stroke={series} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={26} /> : null}
              <Area isAnimationActive={false} yAxisId="money" dataKey="amount" name="金额" stroke={accent} fill="transparent" strokeWidth={2} />
              {metric === 'all' ? <Line isAnimationActive={false} yAxisId="money" dataKey="orders" name="订单数" stroke={series} dot={false} strokeWidth={1.5} /> : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="lab-recharts-brush">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Line dataKey="views" stroke={accent} dot={false} isAnimationActive={false} strokeWidth={1.4} />
              <Brush
                dataKey="name"
                height={38}
                travellerWidth={10}
                stroke={accent}
                fill={soft}
                startIndex={range.start}
                endIndex={range.end}
                onChange={(next: { startIndex?: number; endIndex?: number }) => {
                  const start = next.startIndex ?? 0;
                  const end = next.endIndex ?? rows.length - 1;
                  setRange({ start: Math.min(start, end), end: Math.max(start, end) });
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ marginTop: 14 }}>
          <Stats>
            <Stat label="区间条数" value={subset.length} />
            <Stat label={metric === 'revenue' ? '区间金额' : '区间浏览'} value={(metric === 'revenue' ? totalAmount : Math.round(avgViews)).toLocaleString('zh-CN')} />
            <Stat label="参考线" value={`${reference.toLocaleString('zh-CN')} · ${referenceLabel}`} />
          </Stats>
        </div>
      </LabLayout>

      <div style={{ marginTop: 22 }}>
        <DataTable head={['日期', '浏览量', '订单数', '金额']} rows={rowsPreview} caption={`Brush 区间末尾 6 条（共 ${subset.length} 条）`} />
      </div>

      <Code text={snippet} onCopy={onCopy} label="Recharts 调用" />
    </Lab>
  );
}
