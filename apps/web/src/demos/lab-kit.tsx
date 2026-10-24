import { createPortal } from 'react-dom';
import { useDialog } from '../hooks/useDialog';
import { IS_TOY } from '../lib/runtime';
import { Children, Fragment, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { DemoCopyHandler } from './types';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** Shared chrome for every real-library / real-service demo. */
export function Lab({
  title,
  badge,
  children,
  reset,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  reset?: () => void;
}) {
  return (
    <section className="demo-workspace lab" aria-label={title}>
      <div className="demo-toolbar">
        <div>
          <h2>{title}</h2>
        </div>
        <div className="lab-toolbar-actions">
          {badge}
          {reset ? (
            <button type="button" className="button button--secondary button--small" onClick={reset}>
              <RotateCcw size={14} aria-hidden="true" />
              重置
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Keep editable source inline; mobile settings live in a bounded dialog. */
export function LabControls({children, className = 'lab-controls', mode = 'sheet'}: {
  children: ReactNode; className?: string; mode?: 'inline' | 'sheet' | 'rich';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDialog(IS_TOY && open, ref, close);
  if (!IS_TOY) return <div className={className}>{children}</div>;
  if (mode === 'inline') return <div className={`${className} toy-editor-input`}>{children}</div>;

  const flatten = (nodes: ReactNode): ReactNode[] => Children.toArray(nodes).flatMap(child =>
    isValidElement<{children?: ReactNode}>(child) && child.type === Fragment
      ? flatten(child.props.children) : [child]);
  const primary = (node: ReactNode): boolean => {
    if (!isValidElement<{className?: string; children?: ReactNode}>(node)) return false;
    return Boolean(node.props.className?.includes('button--primary')) || Children.toArray(node.props.children).some(primary);
  };
  const settings: ReactNode[] = [], actions: ReactNode[] = [], feedback: ReactNode[] = [];
  for (const child of flatten(children)) {
    if (isValidElement<{className?: string}>(child) && (child.type === Stats || child.type === ErrorNote || child.type === Status || child.props.className === 'lab-stats' || /__hint$|^lab-g6-detail$/.test(child.props.className || ''))) feedback.push(child);
    else if (isValidElement<{className?: string}>(child) && (/__(actions|toolbar)$/.test(child.props.className || '') || (child.props.className === 'lab-options' && (mode === 'rich' || primary(child))))) actions.push(child);
    else settings.push(child);
  }
  const hasSettings = settings.some(child => isValidElement(child) && child.type !== 'p');
  return <>
    {actions.length || hasSettings ? <div className="toy-control-bar">
      {actions.length ? <div className="toy-quick-actions">{actions}</div> : null}
      {hasSettings ? <button type="button" className="button button--secondary toy-parameter-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><SlidersHorizontal size={16} aria-hidden="true"/>参数与操作</button> : null}
    </div> : null}
    {feedback.length ? <div className="toy-control-feedback">{feedback}</div> : null}
    {open ? createPortal(<div className="toy-parameter-backdrop" onPointerDown={event => {if(event.target === event.currentTarget) close();}}>
      <div className="toy-parameter-sheet" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="toy-parameter-head"><h2 id={titleId}>示例参数</h2><button type="button" className="button button--primary button--small" onClick={close}>完成</button></div>
        <div className="toy-parameter-body"><div className={`${className} lab-controls`}>{settings}</div></div>
      </div>
    </div>, document.querySelector('.toy-shell') || document.body) : null}
  </>;
}

export function LabLayout({ controls, children, layout = 'split' }: { controls: ReactNode; children: ReactNode; layout?: 'split' | 'toolbar' | 'editor' | 'rich' }) {
  return (
    <div className={`lab-layout lab-layout--${layout}`}>
      <LabControls mode={layout === 'editor' ? 'inline' : layout === 'rich' ? 'rich' : 'sheet'}>{controls}</LabControls>
      <div className="lab-stage">{children}</div>
    </div>
  );
}

export function Stage({ children, tall }: { children: ReactNode; tall?: boolean }) {
  return <div className={tall ? 'lab-stage lab-stage--tall' : 'lab-stage'}>{children}</div>;
}

export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (n: number) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <label className="range-field" htmlFor={id}>
      <span>
        {label}
        <output>
          {value}
          {unit}
        </output>
      </span>
      <input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (string | readonly [string, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="lab-field">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => {
          const [v, n] = typeof o === 'string' ? [o, o] : o;
          return (
            <option key={v} value={v}>
              {n}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="lab-field">
      {label ? <span>{label}</span> : null}
      <div className="segmented" role="group" aria-label={label ?? '切换'}>
        {options.map(([v, n]) => (
          <button key={v} type="button" className={v === value ? 'is-active' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  rows,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <label className="lab-field" htmlFor={id}>
      <span>{label}</span>
      {rows ? (
        <textarea id={id} aria-label={label} className={mono ? 'lab-editor lab-editor--short' : undefined} wrap={IS_TOY && mono ? 'off' : undefined} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} aria-label={label} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function Code({
  text,
  onCopy,
  label = '代码',
  maxHeight,
}: {
  text: string;
  onCopy: DemoCopyHandler;
  label?: string;
  maxHeight?: number;
}) {
  const content = (
    <div className="lab-code">
      <div>
        <span>{label}</span>
        <button type="button" className="copy-button" onClick={() => void onCopy(text, label)}>
          <Copy size={14} aria-hidden="true" />
          复制{label}
        </button>
      </div>
      <pre tabIndex={0} style={maxHeight ? { maxHeight } : undefined}>
        <code>{text}</code>
      </pre>
    </div>
  );
  return IS_TOY ? <details className="toy-code"><summary>{label}</summary>{content}</details> : content;
}

/** Real error surface. Never fake a success to hide a failure. */
export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="lab-error" role="alert">
      <AlertTriangle size={15} aria-hidden="true" />
      <div>
        <strong>{children}</strong>
        {onRetry ? (
          <button type="button" className="button button--secondary button--small lab-error__retry" onClick={onRetry}>
            重试
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Status({ children, tone }: { children: ReactNode; tone?: 'ok' | 'warn' }) {
  return (
    <p className="lab-status" data-tone={tone ?? 'plain'}>
      {tone === 'ok' ? <Check size={14} aria-hidden="true" /> : null}
      {children}
    </p>
  );
}

function isTextStat(value: ReactNode, format: 'auto' | 'number' | 'text' = 'auto') {
  return format === 'text' || (format === 'auto' && (typeof value === 'string'
    ? value.length > 14 || (!/\d/.test(value) && !/^[—–-]$/.test(value))
    : typeof value !== 'number'));
}

export function Stat({ label, value, format = 'auto' }: { label: string; value: ReactNode; format?: 'auto' | 'number' | 'text' }) {
  const textual = isTextStat(value, format);
  const wide = textual && (typeof value !== 'string' || value.length > 24);
  return (
    <div data-format={textual ? 'text' : 'number'} data-wide={wide || undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  const numeric = Children.toArray(children).filter(child => isValidElement<{value: ReactNode; format?: 'auto' | 'number' | 'text'}>(child) && child.type === Stat && !isTextStat(child.props.value, child.props.format)).length;
  const columns = numeric <= 1 ? 1 : numeric === 3 || numeric === 6 ? 3 : 2;
  return <div className="lab-stats" data-toy-columns={IS_TOY ? columns : undefined}>{children}</div>;
}

/** Simple scrollable table so wide result sets never overflow the page. */
export function DataTable({ head, rows, caption }: { head: readonly string[]; rows: readonly (readonly (ReactNode)[])[]; caption?: string }) {
  return (
    <div className="lab-table-wrap" tabIndex={0}>
      <table className="lab-table">
        {caption ? <caption className="lab-table__caption">{caption}</caption> : null}
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="lab-table__empty">
                没有数据
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Canvas host that never leaks: renderer setup + teardown, DPR aware, no hover motion. */
export function useCanvasStage(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  deps: unknown[],
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(ctx, w, h);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = host.getBoundingClientRect();
    drawRef.current(ctx, Math.max(1, rect.width), Math.max(1, rect.height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    ref: hostRef,
    canvasRef,
  };
}

/** requestAnimationFrame loop with guaranteed cancel on unmount / effect change. */
export function useAnimationFrame(active: boolean, frame: (t: number, dt: number) => void) {
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      frameRef.current(now, dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

/** Respects the OS reduced-motion setting for every animated demo. */
export function useMotionOk(): boolean {
  return useReducedMotion() === false;
}
/** Stable, dependency-free id generator for charts/graphs. */
export function useStableId(prefix: string): string {
  const ref = useRef<string>('');
  if (!ref.current) ref.current = `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  return ref.current;
}

/** Small helper: pretty-print JSON with a hard output cap. */
export function prettyJSON(value: unknown, limit = 4000): string {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    return '无法序列化该结果。';
  }
  return text.length > limit ? `${text.slice(0, limit)}\n… 已截断，共 ${text.length} 字符` : text;
}

/** Deterministic pseudo-random sequence so demo data is stable across renders. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Reads CSS custom properties so canvas/WebGL scenes follow the active theme. */
export function useThemeColors(): Record<string, string> {
  const [colors, setColors] = useState<Record<string, string>>(() => readColors());
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setColors(readColors());
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

function readColors(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const styles = getComputedStyle(document.documentElement);
  const names = ['--ink', '--muted', '--line', '--line-strong', '--surface', '--surface-2', '--accent', '--accent-soft', '--accent-strong', '--ink-soft'];
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = styles.getPropertyValue(name).trim();
    if (value) out[name.replace('--', '')] = value;
  }
  return out;
}

/** Guarded fetch for the real backend: abortable, typed, never fabricates a response. */
export async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`);
  return (await response.json()) as T;
}

/** Debounced value, cleaned up on unmount. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useResetSignal(resetKey: number, run: () => void) {
  const runRef = useRef(run);
  runRef.current = run;
  return useCallback(() => runRef.current(), [resetKey]);
}

/** Stable unique ids for list rendering in charts/graphs. */
export function useMemoized<T>(factory: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
