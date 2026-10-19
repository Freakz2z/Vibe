import { useEffect, useMemo, useRef, useState } from 'react';
import { Lab, Range, Select } from './LabControls';
import { sortFrames } from './lab-utils';

const INITIAL = [64, 28, 82, 42, 18, 70, 36, 54];
export function SortingLab() {
  const [algorithm, setAlgorithm] = useState('bubble'), [step, setStep] = useState(0), [playing, setPlaying] = useState(false), [delay, setDelay] = useState(300);
  const frames = useMemo(() => sortFrames(INITIAL, algorithm), [algorithm]), frame = frames[Math.min(step, frames.length - 1)];
  useEffect(() => { if (!playing) return; if (step >= frames.length - 1) { setPlaying(false); return; } const timer = window.setTimeout(() => setStep(s => s + 1), delay); return () => clearTimeout(timer); }, [playing, step, delay, frames.length]);
  return <Lab title="排序过程" reset={() => { setStep(0); setPlaying(false); }}><div className="lab-layout"><div className="lab-controls"><Select label="排序算法" value={algorithm} options={[["bubble", "冒泡排序"], ["insertion", "插入排序"]]} onChange={v => { setAlgorithm(v); setStep(0); setPlaying(false); }} /><Range label="每步间隔" value={delay} min={100} max={1000} step={100} unit="ms" onChange={setDelay} /><div className="lab-options"><button className="button button--primary" disabled={step >= frames.length - 1} onClick={() => setPlaying(p => !p)}>{playing ? '暂停' : '播放'}</button><button className="button button--secondary" disabled={playing || step >= frames.length - 1} onClick={() => setStep(s => Math.min(s + 1, frames.length - 1))}>下一步</button><button className="button button--quiet" onClick={() => { setPlaying(false); setStep(frames.length - 1); }}>完成排序</button></div><p className="lab-status" role="status">第 {step + 1} / {frames.length} 步 · {frame.action}</p><p className="demo-caption">橙色为当前比较项，绿色为已确定的有序区域。柱形高度对应数值。</p></div><div className="lab-stage lab-sort" aria-label="排序数组">{frame.values.map((v, i) => <div key={i} className={`lab-sort-bar ${frame.comparing.includes(i) ? 'is-comparing' : frame.sorted.includes(i) ? 'is-sorted' : ''}`} style={{ height: `${v * 2 + 32}px` }}><span>{v}</span></div>)}</div></div></Lab>;
}
interface EventLog { type: string; at: number; }
export function DebounceLab() {
  const [wait, setWait] = useState(500), [logs, setLogs] = useState<EventLog[]>([]), [counts, setCounts] = useState({ raw: 0, debounce: 0, throttle: 0 }), [bursting, setBursting] = useState(false);
  const origin = useRef(performance.now()), last = useRef(-Infinity), timer = useRef<number>(), burst = useRef<number>();
  const append = (type: 'raw' | 'debounce' | 'throttle') => { const at = Math.round(performance.now() - origin.current); setCounts(c => ({ ...c, [type]: c[type] + 1 })); setLogs(l => [{ type, at }, ...l].slice(0, 40)); };
  const fire = () => {
    append('raw'); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => append('debounce'), wait);
    const now = performance.now(); if (now - last.current >= wait) { last.current = now; append('throttle'); }
  };
  const stop = () => { window.clearTimeout(timer.current); window.clearInterval(burst.current); setBursting(false); };
  const reset = () => { stop(); last.current = -Infinity; origin.current = performance.now(); setLogs([]); setCounts({ raw: 0, debounce: 0, throttle: 0 }); };
  useEffect(() => () => { window.clearTimeout(timer.current); window.clearInterval(burst.current); }, []);
  const runBurst = () => { stop(); setBursting(true); let n = 0; fire(); burst.current = window.setInterval(() => { fire(); if (++n >= 9) { window.clearInterval(burst.current); setBursting(false); } }, 100); };
  const labels = { raw: '原始事件', debounce: '防抖执行', throttle: '节流执行' };
  return <Lab title="防抖与节流" reset={reset}><div className="lab-layout"><div className="lab-controls"><Range label="等待窗口" value={wait} min={200} max={1200} step={100} unit="ms" onChange={v => { reset(); setWait(v); }} /><button className="button button--primary" disabled={bursting} onClick={fire}>触发一次</button><button className="button button--secondary" disabled={bursting} onClick={runBurst}>连续触发 10 次</button><p className="demo-caption">防抖在输入停止后执行；节流在窗口起点执行。连续触发间隔为 100ms，计数取决于当前等待窗口。</p></div><div className="lab-stage"><div className="lab-stats" aria-live="polite">{Object.entries(counts).map(([type, count]) => <div key={type}><span>{labels[type as keyof typeof labels]}</span><strong>{count}</strong></div>)}</div><ol className="lab-event-log">{logs.map((l, i) => <li key={i} data-kind={l.type}><span>{labels[l.type as keyof typeof labels]}</span><code>{l.at}ms</code></li>)}</ol></div></div></Lab>;
}
export function CacheLab() {
  const [ttl, setTtl] = useState(3000), [delay, setDelay] = useState(700), [network, setNetwork] = useState(0), [hits, setHits] = useState(0), [merges, setMerges] = useState(0), [status, setStatus] = useState('尚未请求'), [data, setData] = useState(''), [now, setNow] = useState(Date.now());
  const cache = useRef<{ value: string; expires: number }>(), pending = useRef<Promise<string> | null>(null), timer = useRef<number>(), generation = useRef(0);
  useEffect(() => { const tick = window.setInterval(() => setNow(Date.now()), 200); return () => { clearInterval(tick); clearTimeout(timer.current); generation.current++; }; }, []);
  const request = async () => {
    const current = generation.current;
    if (cache.current && Date.now() < cache.current.expires) { setHits(h => h + 1); setData(cache.current.value); setStatus('命中缓存'); return; }
    if (pending.current) { setMerges(m => m + 1); setStatus('已合并到正在进行的请求'); await pending.current; return; }
    setStatus('模拟请求中…'); setNetwork(n => n + 1);
    pending.current = new Promise<string>(resolve => { timer.current = window.setTimeout(() => resolve(`响应 · ${new Date().toLocaleTimeString('zh-CN')}`), delay); });
    const value = await pending.current;
    if (current !== generation.current) return;
    cache.current = { value, expires: Date.now() + ttl }; pending.current = null; setData(value); setNow(Date.now()); setStatus('模拟请求完成，已写入缓存');
  };
  const invalidate = () => { cache.current = undefined; setNow(Date.now()); setStatus('缓存已清除'); };
  const reset = () => { clearTimeout(timer.current); generation.current++; pending.current = null; cache.current = undefined; setNetwork(0); setHits(0); setMerges(0); setData(''); setStatus('尚未请求'); };
  const remaining = Math.max(0, Math.ceil(((cache.current?.expires || 0) - now) / 1000));
  return <Lab title="请求缓存" reset={reset}><div className="lab-layout"><div className="lab-controls"><Range label="缓存有效期" value={ttl} min={1000} max={10000} step={1000} unit="ms" onChange={v => { reset(); setTtl(v); }} /><Range label="模拟网络延迟" value={delay} min={200} max={2000} step={100} unit="ms" onChange={v => { reset(); setDelay(v); }} /><button className="button button--primary" onClick={() => void request()}>请求数据</button><button className="button button--secondary" onClick={() => { void request(); void request(); void request(); }}>同时请求 3 次</button><button className="button button--quiet" onClick={invalidate}>清除缓存</button><p className="demo-caption">使用本地定时器模拟请求，没有调用真实服务器。相同的进行中请求共享一个 Promise。</p></div><div className="lab-stage"><div className="lab-stats" aria-live="polite"><div><span>模拟网络请求</span><strong>{network}</strong></div><div><span>命中缓存</span><strong>{hits}</strong></div><div><span>合并请求</span><strong>{merges}</strong></div></div><p className="lab-status" role="status">{status}</p><div className="lab-cache-value">{data || '暂无数据'}<small>缓存剩余 {remaining} 秒</small></div></div></div></Lab>;
}
