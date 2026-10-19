import { useState, type CSSProperties } from 'react';
import { Lab, Range, Select, Color, Code } from './LabControls';
import { contrast } from './lab-utils';
import type { DemoCopyHandler } from './types';

export function ContrastLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [fg, setFg] = useState('#1e293b'), [bg, setBg] = useState('#fff7ed');
  const ratio = contrast(fg, bg);
  return <Lab title="颜色对比度" reset={() => { setFg('#1e293b'); setBg('#fff7ed'); }}><div className="lab-layout"><div className="lab-controls"><Color label="文字颜色" value={fg} onChange={setFg} /><Color label="背景颜色" value={bg} onChange={setBg} /><strong className="lab-metric" aria-live="polite">{ratio.toFixed(2)} : 1</strong><ul className="lab-checks">{[['普通文字 AA', 4.5], ['普通文字 AAA', 7], ['大号文字 AA', 3]].map(([label, threshold]) => <li key={label} data-pass={ratio >= Number(threshold)}>{ratio >= Number(threshold) ? '通过' : '未通过'} · {label} ≥ {threshold} : 1</li>)}</ul></div><div className="lab-stage lab-contrast" style={{ color: fg, background: bg }}><h3>颜色与文字</h3><p>颜色会影响文字与背景之间的辨识程度。</p><small>大号文字：至少 24px，或至少 18.66px 的粗体文字。</small></div></div><Code text={`color: ${fg};\nbackground-color: ${bg};\n/* WCAG contrast: ${ratio.toFixed(2)}:1 */`} onCopy={onCopy} label="CSS" /><p className="demo-caption">使用 WCAG 2.x 的 sRGB 相对亮度公式。对比度数值不替代完整的无障碍检查。</p></Lab>;
}
export function GridLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [columns, setColumns] = useState(3), [gap, setGap] = useState(12), [span, setSpan] = useState(1);
  const effectiveSpan = Math.min(columns, span);
  const css = `.grid {\n  display: grid;\n  grid-template-columns: repeat(${columns}, minmax(0, 1fr));\n  gap: ${gap}px;\n}\n.grid > :first-child { grid-column: span ${effectiveSpan}; }`;
  return <Lab title="Grid 布局" reset={() => { setColumns(3); setGap(12); setSpan(1); }}><div className="lab-layout"><div className="lab-controls"><Range label="列数" value={columns} min={1} max={6} onChange={n => { setColumns(n); setSpan(s => Math.min(s, n)); }} /><Range label="间距" value={gap} min={0} max={32} unit="px" onChange={setGap} /><Range label="首项跨列" value={span} min={1} max={columns} onChange={setSpan} /></div><div className="lab-stage lab-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }}>{Array.from({ length: 9 }, (_, i) => <div className="lab-tile" style={i === 0 ? { gridColumn: `span ${effectiveSpan}` } : {}} key={i}>{i + 1}</div>)}</div></div><Code text={css} onCopy={onCopy} label="CSS" /></Lab>;
}
export function ShadowLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [x, setX] = useState(8), [y, setY] = useState(12), [blur, setBlur] = useState(24), [spread, setSpread] = useState(0), [alpha, setAlpha] = useState(20);
  const shadow = `${x}px ${y}px ${blur}px ${spread}px rgb(0 0 0 / ${alpha}%)`;
  return <Lab title="阴影编辑器" reset={() => { setX(8); setY(12); setBlur(24); setSpread(0); setAlpha(20); }}><div className="lab-layout"><div className="lab-controls"><Range label="水平偏移" value={x} min={-40} max={40} unit="px" onChange={setX} /><Range label="垂直偏移" value={y} min={-40} max={40} unit="px" onChange={setY} /><Range label="模糊半径" value={blur} min={0} max={64} unit="px" onChange={setBlur} /><Range label="扩张半径" value={spread} min={-16} max={24} unit="px" onChange={setSpread} /><Range label="不透明度" value={alpha} min={0} max={60} unit="%" onChange={setAlpha} /></div><div className="lab-stage lab-center"><div className="lab-shadow-card" style={{ boxShadow: shadow }}>Aa<br /><small>Box shadow</small></div></div></div><Code text={`box-shadow: ${shadow};`} onCopy={onCopy} label="CSS" /></Lab>;
}
export function TypographyLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [base, setBase] = useState(16), [ratio, setRatio] = useState(1.25);
  const sizes = Array.from({ length: 6 }, (_, i) => Math.round(base * ratio ** i * 100) / 100);
  return <Lab title="字体比例尺" reset={() => { setBase(16); setRatio(1.25); }}><div className="lab-layout"><div className="lab-controls"><Range label="基础字号" value={base} min={12} max={24} unit="px" onChange={setBase} /><Range label="缩放比例" value={ratio} min={1.05} max={1.5} step={.05} onChange={setRatio} /><p className="demo-caption">每一级字号 = 基础字号 × 比例的级数次方。</p></div><div className="lab-stage lab-type">{sizes.map((size, i) => <div key={i}><span style={{ fontSize: size }}>文字层级 {i + 1}</span><code>{size}px</code></div>)}</div></div><Code text={`:root {\n${sizes.map((s, i) => `  --text-${i}: ${s}px;`).join('\n')}\n}`} onCopy={onCopy} label="CSS" /></Lab>;
}
export function FlexLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [direction, setDirection] = useState('row'), [justify, setJustify] = useState('space-between'), [align, setAlign] = useState('center'), [wrap, setWrap] = useState('wrap'), [gap, setGap] = useState(12);
  const style = { display: 'flex', flexDirection: direction, justifyContent: justify, alignItems: align, flexWrap: wrap, gap } as CSSProperties;
  return <Lab title="Flex 布局" reset={() => { setDirection('row'); setJustify('space-between'); setAlign('center'); setWrap('wrap'); setGap(12); }}><div className="lab-layout"><div className="lab-controls"><Select label="排列方向" value={direction} onChange={setDirection} options={['row', 'column']} /><Select label="主轴分配" value={justify} onChange={setJustify} options={['flex-start', 'center', 'space-between', 'space-around', 'flex-end']} /><Select label="交叉轴对齐" value={align} onChange={setAlign} options={['flex-start', 'center', 'stretch', 'flex-end']} /><Select label="换行" value={wrap} onChange={setWrap} options={['wrap', 'nowrap']} /><Range label="项目间距" value={gap} min={0} max={32} unit="px" onChange={setGap} /></div><div className="lab-stage lab-flex" style={style}>{[1, 2, 3, 4, 5].map(i => <div className="lab-tile" style={{ minHeight: 36 + i * 8 }} key={i}>{i}</div>)}</div></div><Code text={`display: flex;\nflex-direction: ${direction};\njustify-content: ${justify};\nalign-items: ${align};\nflex-wrap: ${wrap};\ngap: ${gap}px;`} onCopy={onCopy} label="CSS" /></Lab>;
}
export function SvgPathLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [x, setX] = useState(200), [y, setY] = useState(20);
  const d = `M 30 170 Q ${x} ${y} 370 170`;
  return <Lab title="SVG 路径" reset={() => { setX(200); setY(20); }}><div className="lab-layout"><div className="lab-controls"><Range label="控制点 X" value={x} min={0} max={400} onChange={setX} /><Range label="控制点 Y" value={y} min={0} max={240} onChange={setY} /><p className="demo-caption">Q 命令定义一个控制点与终点。曲线经过端点，向控制点方向弯曲。</p></div><div className="lab-stage"><svg className="lab-svg" viewBox="0 0 400 240" role="img" aria-label="二次贝塞尔曲线预览"><path d={`M30 170 L${x} ${y} L370 170`} fill="none" stroke="var(--muted)" strokeDasharray="5 5" /><path d={d} fill="none" stroke="var(--accent)" strokeWidth="4" /><circle cx={x} cy={y} r="7" fill="var(--accent)" /><circle cx="30" cy="170" r="5" fill="var(--ink)" /><circle cx="370" cy="170" r="5" fill="var(--ink)" /></svg></div></div><Code text={`<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">\n  <path d="${d}" fill="none" stroke="#d45c3b" stroke-width="4" />\n</svg>`} onCopy={onCopy} label="SVG" /></Lab>;
}
