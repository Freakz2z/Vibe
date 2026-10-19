import { useEffect, useMemo, useState } from 'react';
import { Lab, Code } from './LabControls';
import { parseCSV } from './lab-utils';
import type { DemoCopyHandler } from './types';

const JSON_SAMPLE = '{"name":"Vibe","tools":["React","Vue"],"public":true,"count":219}';
function countNodes(value: unknown, depth = 0): number {
  if (depth > 50) return 1;
  if (Array.isArray(value)) return 1 + value.reduce<number>((n, v) => n + countNodes(v, depth + 1), 0);
  if (value && typeof value === 'object') return 1 + Object.values(value).reduce<number>((n, v) => n + countNodes(v, depth + 1), 0);
  return 1;
}
export function JsonLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [input, setInput] = useState(JSON_SAMPLE), [compact, setCompact] = useState(false);
  const parsed = useMemo(() => { try { const value: unknown = JSON.parse(input); return { value, text: JSON.stringify(value, null, compact ? undefined : 2), count: countNodes(value), error: '' }; } catch (e) { return { text: '', count: 0, error: e instanceof Error ? e.message : '无法解析 JSON' }; } }, [input, compact]);
  return <Lab title="JSON 格式化" reset={() => { setInput(JSON_SAMPLE); setCompact(false); }}><div className="lab-editor-grid"><label className="lab-field"><span>JSON 输入</span><textarea className="lab-editor" spellCheck={false} maxLength={100000} value={input} onChange={e => setInput(e.target.value)} /></label><div><div className="lab-options"><label><input type="checkbox" checked={compact} onChange={e => setCompact(e.target.checked)} />压缩输出</label><span role="status">{parsed.error ? '格式错误' : `${Array.isArray(parsed.value) ? '数组' : parsed.value === null ? 'null' : typeof parsed.value} · ${parsed.count} 个节点`}</span></div>{parsed.error ? <p className="lab-error" role="alert">{parsed.error}</p> : <Code text={parsed.text} onCopy={onCopy} label="JSON" />}</div></div></Lab>;
}
const CSV_SAMPLE = '工具,分类,说明\nReact,前端,"组件,状态与界面"\nVue,前端,响应式组件\nDuckDB,数据库,"支持 CSV 和 Parquet"';
export function CsvLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [input, setInput] = useState(CSV_SAMPLE), [header, setHeader] = useState(true);
  const result = useMemo(() => {
    try {
      const rows = parseCSV(input); const width = Math.max(0, ...rows.map(r => r.length));
      const headings = header ? rows[0] || [] : Array.from({ length: width }, (_, i) => `列 ${i + 1}`);
      if (header && new Set(headings).size !== headings.length) throw Error('表头存在重复字段，请修改表头或关闭首行作为表头');
      if (rows.some(r => r.length !== width)) throw Error('各行列数不一致，请检查逗号与引号');
      const data = header ? rows.slice(1) : rows;
      const json = data.map(row => Object.fromEntries(headings.map((h, i) => [h || `列 ${i + 1}`, row[i] ?? ''])));
      return { headings, rows: data, json, error: '' };
    } catch (e) { return { headings: [], rows: [], json: [], error: e instanceof Error ? e.message : 'CSV 格式错误' }; }
  }, [input, header]);
  return <Lab title="CSV 数据预览" reset={() => { setInput(CSV_SAMPLE); setHeader(true); }}><label className="lab-field"><span>CSV 输入</span><textarea className="lab-editor" maxLength={25000} value={input} onChange={e => setInput(e.target.value)} spellCheck={false} /></label><div className="lab-options"><label><input type="checkbox" checked={header} onChange={e => setHeader(e.target.checked)} />首行作为表头</label><span role="status">{result.rows.length} 行 · {result.headings.length} 列</span></div>{result.error ? <p role="alert" className="lab-error">{result.error}</p> : <><div className="lab-table-wrap" tabIndex={0}><table className="lab-table"><thead><tr>{result.headings.slice(0, 20).map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{result.rows.slice(0, 50).map((r, i) => <tr key={i}>{r.slice(0, 20).map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>{result.rows.length > 50 && <p className="demo-caption">表格显示前 50 行，JSON 输出保留全部数据。</p>}<Code text={JSON.stringify(result.json, null, 2)} onCopy={onCopy} label="JSON" /></>}</Lab>;
}
interface RegexMatch { text: string; index: number; groups: string[]; }
export function RegexLab() {
  const [pattern, setPattern] = useState('\\b[A-Z][a-z]+\\b'), [flags, setFlags] = useState('g'), [text, setText] = useState('React and Vue build interfaces. Vibe connects useful tools.');
  const [result, setResult] = useState<{ matches: RegexMatch[]; error: string; pending: boolean }>({ matches: [], error: '', pending: true });
  useEffect(() => {
    setResult({ matches: [], error: '', pending: true });
    const worker = new Worker(new URL('./regex.worker.ts', import.meta.url), { type: 'module' });
    const timer = window.setTimeout(() => { worker.terminate(); setResult({ matches: [], error: '计算已停止：规则运行时间超过 300ms，请简化表达式。', pending: false }); }, 300);
    worker.onmessage = (e: MessageEvent<{ matches?: RegexMatch[]; error?: string }>) => { clearTimeout(timer); setResult({ matches: e.data.matches || [], error: e.data.error || '', pending: false }); worker.terminate(); };
    worker.onerror = () => { clearTimeout(timer); setResult({ matches: [], error: '计算线程未能启动，请重新输入。', pending: false }); worker.terminate(); };
    worker.postMessage({ pattern, flags, text });
    return () => { clearTimeout(timer); worker.terminate(); };
  }, [pattern, flags, text]);
  return <Lab title="正则表达式" reset={() => { setPattern('\\b[A-Z][a-z]+\\b'); setFlags('g'); setText('React and Vue build interfaces. Vibe connects useful tools.'); }}><div className="lab-options"><label className="lab-field lab-grow"><span>正则规则</span><input maxLength={160} value={pattern} onChange={e => setPattern(e.target.value)} spellCheck={false} /></label><label className="lab-field"><span>标志</span><input maxLength={8} className="lab-flags" value={flags} onChange={e => setFlags(e.target.value)} spellCheck={false} /></label></div><label className="lab-field"><span>测试文本</span><textarea className="lab-editor" maxLength={5000} value={text} onChange={e => setText(e.target.value)} /></label><p className="lab-status" role="status">{result.pending ? '正在匹配…' : `${result.matches.length} 个匹配${result.matches.length === 200 ? '（显示上限）' : ''}`}</p>{result.error ? <p role="alert" className="lab-error">{result.error}</p> : <ol className="lab-matches">{result.matches.map((m, i) => <li key={i}><code>{m.text || '（空匹配）'}</code><span>位置 {m.index}{m.groups.length ? ` · 分组 ${JSON.stringify(m.groups)}` : ''}</span></li>)}</ol>}<p className="demo-caption">使用浏览器 JavaScript RegExp。计算在独立线程执行，超时自动终止；输入内容不上传。</p></Lab>;
}
