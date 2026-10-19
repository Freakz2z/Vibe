import { useId, type ReactNode } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import type { DemoCopyHandler } from './types';

export function Lab({ title, children, reset }: { title: string; children: ReactNode; reset?: () => void }) {
  return <section className="demo-workspace lab" aria-label={title}>
    <div className="demo-toolbar"><h2>{title}</h2>{reset && <button className="button button--secondary button--small" onClick={reset}><RotateCcw size={14} />重置</button>}</div>
    {children}
  </section>;
}
export function Range({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void }) {
  const id = useId();
  return <label className="range-field" htmlFor={id}><span>{label}<output>{value}{unit}</output></span><input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></label>;
}
export function Select({ label, value, options, onChange }: { label: string; value: string; options: (string | [string, string])[]; onChange: (s: string) => void }) {
  return <label className="lab-field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map(o => { const [v, n] = typeof o === 'string' ? [o, o] : o; return <option key={v} value={v}>{n}</option>; })}</select></label>;
}
export function Color({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return <label className="lab-field lab-color"><span>{label}</span><input type="color" aria-label={label} value={value} onChange={e => onChange(e.target.value)} /><code>{value.toUpperCase()}</code></label>;
}
export function Code({ text, onCopy, label = '代码' }: { text: string; onCopy: DemoCopyHandler; label?: string }) {
  return <div className="lab-code"><div><span>{label}</span><button className="copy-button" onClick={() => void onCopy(text, label)}><Copy size={14} />复制{label}</button></div><pre tabIndex={0}><code>{text}</code></pre></div>;
}
