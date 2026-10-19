import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, LabLayout, Segmented, Stat, Stats, Status, useMotionOk, useStableId, useThemeColors } from '../lab-kit';

interface Bar {
  id: string;
  label: string;
  value: number;
}

type DatasetKey = 'east' | 'north' | 'all';

const DATASETS: readonly (readonly [DatasetKey, string])[] = [
  ['east', '华东大区'],
  ['north', '华北大区'],
  ['all', '全渠道合计'],
];

const WIDTH = 720;
const HEIGHT = 330;
const MARGIN = { top: 18, right: 16, bottom: 44, left: 56 };

const RAW: Record<DatasetKey, Bar[]> = {
  east: [
    { id: 'sh', label: '上海', value: 168 },
    { id: 'hz', label: '杭州', value: 142 },
    { id: 'nj', label: '南京', value: 96 },
    { id: 'su', label: '苏州', value: 88 },
    { id: 'hf', label: '合肥', value: 47 },
  ],
  north: [
    { id: 'bj', label: '北京', value: 205 },
    { id: 'tj', label: '天津', value: 74 },
    { id: 'sjz', label: '石家庄', value: 41 },
    { id: 'jn', label: '济南', value: 88 },
  ],
  all: [
    { id: 'bj', label: '北京', value: 205 },
    { id: 'sh', label: '上海', value: 168 },
    { id: 'hz', label: '杭州', value: 142 },
    { id: 'sz', label: '深圳', value: 197 },
    { id: 'cd', label: '成都', value: 131 },
    { id: 'jn', label: '济南', value: 88 },
  ],
};

/**
 * D3 v7 data join: `selectAll().data(_, keyFn)` with explicit
 * `enter().append()` / `update()` / `exit().remove()`, real scales and real axes.
 * The counts below are measured from the selection, not guessed.
 */
export default function D3Lab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const colors = useThemeColors();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dataset, setDataset] = useState<DatasetKey>('east');
  const [counts, setCounts] = useState({ enter: 0, update: 0, exit: 0 });
  const [error, setError] = useState<string | null>(null);
  const themeKey = useStableId('d3');

  const rows = useMemo(() => RAW[dataset], [dataset]);
  const ink = colors.ink ?? '#222';
  const muted = colors.muted ?? '#888';
  const line = colors.line ?? '#ddd';
  const accent = colors.accent ?? '#e2725b';
  const soft = colors['accent-soft'] ?? '#f6e3dc';

  // Scaffolding only: rebuilt when the theme flips, never when the data changes,
  // so the join below really reuses the existing rects.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const root = d3.select(svg);
      root.selectAll('*').remove();
      root
        .append('g')
        .attr('class', 'd3-grid')
        .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
      root.append('g').attr('class', 'd3-axis-y').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
      root.append('g').attr('class', 'd3-axis-x').attr('transform', `translate(${MARGIN.left},${HEIGHT - MARGIN.bottom})`);
      root.append('g').attr('class', 'd3-bars').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
      root.append('g').attr('class', 'd3-labels').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
      root.selectAll('.d3-axis text').attr('fill', muted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [themeKey, muted]);

  // The data join itself. Runs only when the dataset changes.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const inner = { w: WIDTH - MARGIN.left - MARGIN.right, h: HEIGHT - MARGIN.top - MARGIN.bottom };
    const root = d3.select(svg);

    const x = d3.scaleBand<string>().domain(rows.map((d) => d.id)).range([0, inner.w]).padding(0.24);
    const y = d3.scaleLinear().domain([0, (d3.max(rows, (d) => d.value) ?? 100) * 1.12]).nice().range([inner.h, 0]);
    const color = d3
      .scaleOrdinal<string, string>()
      .domain(rows.map((d) => d.id))
      .range(d3.schemeTableau10.length >= rows.length ? d3.schemeTableau10 : [accent, ink, muted]);

    const apply = (bars: d3.Selection<SVGGElement, Bar, SVGGElement, unknown>, withTransition: boolean) => {
      const set = (s: d3.Selection<SVGRectElement, Bar, SVGGElement, unknown>) => {
        const target = s
          .attr('x', (d) => x(d.id) ?? 0)
          .attr('width', x.bandwidth())
          .attr('fill', (d) => color(d.id))
          .attr('rx', 3);
        return withTransition
          ? target.transition().duration(460).ease(d3.easeCubicOut).attr('y', (d) => y(d.value)).attr('height', (d) => inner.h - y(d.value))
          : target.attr('y', (d) => y(d.value)).attr('height', (d) => inner.h - y(d.value));
      };
      set(bars.selectAll<SVGRectElement, Bar>('rect.d3-bar'));
      bars
        .selectAll<SVGTextElement, Bar>('text.d3-label')
        .attr('x', (d) => (x(d.id) ?? 0) + x.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('fill', muted)
        .attr('y', (d) => Math.max(11, y(d.value) - 6))
        .text((d) => d.label);
    };

    const yAxis = d3.axisLeft(y).ticks(5).tickSize(-inner.w).tickFormat((v) => String(v));
    const xAxis = d3.axisBottom(x).tickSize(0);
    const grid = d3.axisLeft(y).ticks(5).tickSize(-inner.w).tickFormat(() => '');

    root.select<SVGGElement>('g.d3-grid').call(grid);
    root.select<SVGGElement>('g.d3-grid').selectAll('line').attr('stroke', line);
    root.select<SVGGElement>('g.d3-grid').selectAll('path').attr('stroke', 'none');
    root.select<SVGGElement>('g.d3-axis-y').call(yAxis);
    root.select<SVGGElement>('g.d3-axis-y').selectAll('line').attr('stroke', line);
    root.select<SVGGElement>('g.d3-axis-y').selectAll('path.domain').attr('stroke', line);
    root.select<SVGGElement>('g.d3-axis-x').call(xAxis);
    root.select<SVGGElement>('g.d3-axis-x').selectAll('path.domain').attr('stroke', line);
    root.selectAll('.d3-axis text').attr('fill', muted);

    // ---- the classic keyed data join ----
    const groups = root.select<SVGGElement>('g.d3-bars');
    const joined = groups.selectAll<SVGGElement, Bar>('g.d3-node').data(rows, (d) => d.id);

    const entered = joined.enter().append<SVGGElement>('g').attr('class', 'd3-node');
    entered
      .append('rect')
      .attr('class', 'd3-bar')
      .attr('x', (d) => x(d.id) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', inner.h)
      .attr('height', 0)
      .attr('fill', (d) => color(d.id))
      .attr('rx', 3);
    entered.append('text').attr('class', 'd3-label');

    const enterCount = entered.size();
    const merged = entered.merge(joined);
    apply(merged, motionOk);

    const exiting = joined.exit();
    const exitCount = exiting.size();
    if (motionOk && exitCount > 0) {
      exiting.transition().duration(320).ease(d3.easeCubicIn).attr('opacity', 0).remove();
    } else {
      exiting.remove();
    }

    setCounts({ enter: enterCount, update: merged.size() - enterCount, exit: exitCount });
  }, [rows, motionOk, line, muted, accent]);

  const snippet = useMemo(
    () =>
      [
        `const x = d3.scaleBand<string>().domain(rows.map(d => d.id)).range([0, width]).padding(0.24);`,
        `const y = d3.scaleLinear().domain([0, d3.max(rows, d => d.value)]).nice().range([height, 0]);`,
        `const color = d3.scaleOrdinal<string, string>().domain(rows.map(d => d.id)).range(palette);`,
        ``,
        `const joined = d3.select(gBars)`,
        `  .selectAll<SVGGElement, Bar>('g.d3-node')`,
        `  .data(rows, d => d.id);            // key 函数决定谁更新、谁退出`,
        ``,
        `const enter = joined.enter().append<SVGGElement>('g').attr('class','d3-node');`,
        `enter.append('rect').attr('class','d3-bar').attr('y', height).attr('height', 0);`,
        `enter.append('text').attr('class','d3-label');`,
        ``,
        `const merged = enter.merge(joined);   // update：复用已有 DOM`,
        `merged.attr('x', d => x(d.id)).attr('width', x.bandwidth()).attr('fill', d => color(d.id));`,
        ``,
        `const exit = joined.exit();`,
        `exit.transition().duration(320).attr('opacity', 0).remove();`,
        ``,
        `d3.select(gAxisX).call(d3.axisBottom(x).tickSize(0));`,
        `d3.select(gAxisY).call(d3.axisLeft(y).ticks(5));`,
        ``,
        `// 上面的 enter / update / exit 数量就是界面上显示的实测值`,
      ].join('\n'),
    [],
  );

  const reset = () => {
    setDataset('east');
    setCounts({ enter: 0, update: 0, exit: 0 });
  };

  return (
    <Lab
      title="D3 v7 键控数据连接"
      badge={<span className="demo-live-badge">D3 v7</span>}
      reset={reset}
    >
      <LabLayout
        controls={
          <>
            <Segmented<DatasetKey> label="数据集" value={dataset} options={DATASETS} onChange={setDataset} />
            <Status>
              切换数据集时带 <code>key 函数</code> 的 <code>data()</code> 会真正触发 enter / update / exit。
            </Status>
            {!motionOk ? <Status tone="warn">系统开启了「减少动态效果」，已关闭补间，数值立即到位。</Status> : null}
          </>
        }
      >
        {error ? <ErrorNote onRetry={reset}>SVG 初始化失败：{error}</ErrorNote> : null}
        <div className="lab-d3-host">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="D3 数据连接柱状图"
            style={{ borderRadius: 12, background: colors.surface ?? 'transparent', border: `1px solid ${soft}` }}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <Stats>
            <Stat label="enter 新增" value={counts.enter} />
            <Stat label="update 复用" value={counts.update} />
            <Stat label="exit 移除" value={counts.exit} />
          </Stats>
        </div>
      </LabLayout>

      <Code text={snippet} onCopy={onCopy} label="D3 调用" />
    </Lab>
  );
}
