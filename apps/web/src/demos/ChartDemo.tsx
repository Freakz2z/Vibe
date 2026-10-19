import { useState } from 'react';

type ChartView = 'bar' | 'line';
type DatasetId = 'steady' | 'rising' | 'wave';

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const DATASETS: Record<DatasetId, { label: string; caption: string; values: number[] }> = {
  steady: {
    label: '平稳一周',
    caption: '波动不大，中途有一天小幅回落。',
    values: [42, 47, 44, 53, 49, 57, 54],
  },
  rising: {
    label: '逐步上升',
    caption: '整体走高，周末增长更明显。',
    values: [31, 36, 41, 46, 54, 61, 68],
  },
  wave: {
    label: '起伏明显',
    caption: '高低交替，适合观察峰谷变化。',
    values: [56, 34, 62, 40, 58, 33, 50],
  },
};

const WIDTH = 680;
const HEIGHT = 304;
const PAD = { top: 28, right: 20, bottom: 44, left: 50 };
const MAX_VALUE = 80;
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
const X_STEP = PLOT_WIDTH / DAYS.length;

const yFor = (value: number) => PAD.top + PLOT_HEIGHT - (value / MAX_VALUE) * PLOT_HEIGHT;
const xFor = (index: number) => PAD.left + X_STEP * (index + 0.5);

export function ChartDemo() {
  const [view, setView] = useState<ChartView>('bar');
  const [datasetId, setDatasetId] = useState<DatasetId>('steady');
  const dataset = DATASETS[datasetId];
  const average = dataset.values.reduce((sum, value) => sum + value, 0) / dataset.values.length;
  const peak = Math.max(...dataset.values);
  const linePoints = dataset.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' ');
  const areaPath = `M ${xFor(0)} ${PAD.top + PLOT_HEIGHT} L ${dataset.values
    .map((value, index) => `${xFor(index)} ${yFor(value)}`)
    .join(' L ')} L ${xFor(dataset.values.length - 1)} ${PAD.top + PLOT_HEIGHT} Z`;
  const barWidth = X_STEP * 0.48;
  const chartLabel = `${dataset.label}演示访问量。${dataset.caption}最高 ${peak} 千次，平均 ${average.toFixed(1)} 千次。`;

  return (
    <section className="demo-workspace chart-demo" aria-label="图表切换原理演示">
      <div className="demo-toolbar chart-toolbar">
        <div>
          <span className="demo-live-badge">演示数据</span>
          <h2>同一组数据，换一种读法</h2>
        </div>
        <div className="segmented" role="group" aria-label="图表类型">
          <button
            type="button"
            className={view === 'bar' ? 'is-active' : ''}
            aria-pressed={view === 'bar'}
            onClick={() => setView('bar')}
          >
            柱状
          </button>
          <button
            type="button"
            className={view === 'line' ? 'is-active' : ''}
            aria-pressed={view === 'line'}
            onClick={() => setView('line')}
          >
            折线
          </button>
        </div>
      </div>

      <div className="chart-layout">
        <div className="chart-card">
          <div className="chart-card__head">
            <div>
              <p className="chart-card__eyebrow">演示访问量 · 千次</p>
              <h3>{dataset.label}</h3>
            </div>
            <span className="chart-card__tag">{view === 'bar' ? '柱状图' : '折线图'}</span>
          </div>

          <div className="chart-canvas">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-labelledby="chart-title chart-desc"
              preserveAspectRatio="xMidYMid meet"
            >
              <title id="chart-title">{chartLabel}</title>
              <desc id="chart-desc">演示数据，不是实时统计。完整数值可在下方数据表中查看。</desc>
              <defs>
                <linearGradient id="chart-area-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {[0, 20, 40, 60, 80].map((tick) => (
                <g key={tick} className="chart-grid-line">
                  <line x1={PAD.left} y1={yFor(tick)} x2={WIDTH - PAD.right} y2={yFor(tick)} />
                  <text x={PAD.left - 12} y={yFor(tick) + 4} textAnchor="end">
                    {tick}
                  </text>
                </g>
              ))}

              {DAYS.map((day, index) => (
                <text
                  className="chart-axis-label"
                  key={day}
                  x={xFor(index)}
                  y={HEIGHT - 18}
                  textAnchor="middle"
                >
                  {day}
                </text>
              ))}

              {view === 'bar' ? (
                <g className="chart-bars">
                  {dataset.values.map((value, index) => {
                    const y = yFor(value);
                    return (
                      <rect
                        key={`${datasetId}-${index}`}
                        className="chart-bar"
                        x={xFor(index) - barWidth / 2}
                        y={y}
                        width={barWidth}
                        height={PAD.top + PLOT_HEIGHT - y}
                        rx="5"
                        style={{ animationDelay: `${index * 45}ms` }}
                      >
                        <title>
                          {DAYS[index]}：{value} 千次
                        </title>
                      </rect>
                    );
                  })}
                </g>
              ) : (
                <g className="chart-line-group">
                  <path className="chart-area" d={areaPath} fill="url(#chart-area-gradient)" />
                  <polyline className="chart-line" points={linePoints} fill="none" />
                  {dataset.values.map((value, index) => (
                    <circle
                      key={`${datasetId}-${index}`}
                      className="chart-dot"
                      cx={xFor(index)}
                      cy={yFor(value)}
                      r="4.5"
                      style={{ animationDelay: `${index * 45}ms` }}
                    >
                      <title>
                        {DAYS[index]}：{value} 千次
                      </title>
                    </circle>
                  ))}
                </g>
              )}
            </svg>
          </div>

          <div className="chart-stats" aria-label="演示数据摘要">
            <div>
              <span>平均</span>
              <strong>{average.toFixed(1)} 千次</strong>
            </div>
            <div>
              <span>最高</span>
              <strong>{peak} 千次</strong>
            </div>
            <div>
              <span>周期</span>
              <strong>7 天</strong>
            </div>
          </div>

          <details className="chart-table">
            <summary>查看数据表</summary>
            <table>
              <caption>{dataset.label}的演示访问量（单位：千次）</caption>
              <thead>
                <tr>
                  <th scope="col">日期</th>
                  <th scope="col">访问量</th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, index) => (
                  <tr key={day}>
                    <th scope="row">{day}</th>
                    <td>{dataset.values[index]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        <div className="chart-controls">
          <div>
            <p className="demo-control-label">换一组走势</p>
            <div className="chart-dataset-list" role="group" aria-label="选择演示数据">
              {(Object.keys(DATASETS) as DatasetId[]).map((id) => (
                <button
                  type="button"
                  key={id}
                  className={`chart-dataset${datasetId === id ? ' is-active' : ''}`}
                  aria-pressed={datasetId === id}
                  onClick={() => setDatasetId(id)}
                >
                  <span>{DATASETS[id].label}</span>
                  <small>{DATASETS[id].caption}</small>
                </button>
              ))}
            </div>
          </div>
          <p className="demo-caption">
            图表由 React 和 SVG 绘制，用来演示柱状与折线的可读性差异。数据是页面内的固定样例，不来自接口，也不是实时统计。
          </p>
          <ul className="chart-notes">
            <li>柱状更容易比较单日高低</li>
            <li>折线更容易看清连续趋势</li>
            <li>数据表为读屏器保留完整数值</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
