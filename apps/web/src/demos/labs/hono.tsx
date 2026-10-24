import { LabControls } from '../lab-kit';
import { apiUrl } from '../../lib/runtime';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, Select, Status, TextField, prettyJSON } from '../lab-kit';

interface GreetResponse {
  technology: 'Hono';
  name: string;
  message: string;
  requestId: string;
  trace: string[];
  generatedAt: string;
}

type Probe =
  | { kind: 'ok'; data: GreetResponse; status: number; router: string; requestId: string }
  | { kind: 'error'; message: string; status: number | null };

const BASE = apiUrl('/api/labs/hono');

/**
 * Hono: every response here comes from a real Hono app running on Workers.
 * The demo surfaces what is actually specific to Hono — route params, the two
 * middleware layers, and the headers Hono sets — and shows real 404/405 states.
 */
export default function HonoLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [name, setName] = useState('小明');
  const [greeting, setGreeting] = useState('你好');
  const [subPath, setSubPath] = useState('greet');
  const [status, setStatus] = useState<Probe | null>(null);
  const [pending, setPending] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const probe = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(true);
    try {
      const encoded = encodeURIComponent(name.trim().slice(0, 40));
      const params = new URLSearchParams({ greeting: greeting.trim().slice(0, 40) });
      const url = `${BASE}/${subPath === 'greet' ? `greet/${encoded}` : subPath}?${params}`;
      const response = await fetch(apiUrl(url), { signal: controller.signal, cache: 'no-store' });
      const router = response.headers.get('X-Demo-Router') ?? '—';
      const requestId = response.headers.get('X-Request-Id') ?? '—';

      if (!response.ok) {
        setStatus({ kind: 'error', message: await response.text(), status: response.status });
        return;
      }
      const data = (await response.json()) as GreetResponse;
      if (controller.signal.aborted) return;
      setStatus({ kind: 'ok', data, status: response.status, router, requestId });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (controller.signal.aborted) return;
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error), status: null });
    } finally {
      if (!controller.signal.aborted && controllerRef.current === controller) setPending(false);
    }
  }, [name, greeting, subPath]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const snippet = status?.kind === 'ok'
    ? [
        `GET ${BASE}/${subPath === 'greet' ? `greet/${encodeURIComponent(name)}` : subPath}?greeting=${greeting}`,
        '',
        `// 真实响应头由 Hono 中间件写入`,
        `X-Demo-Router: ${status.router}`,
        `X-Request-Id:   ${status.requestId}`,
        '',
        `// 中间件 trace（两层中间件 + handler）`,
        status.data.trace.map((step) => `  ${step}`).join('\n'),
      ].join('\n')
    : '';

  return (
    <Lab title="Hono 路由与中间件" badge={<span className="demo-live-badge">Cloudflare Workers</span>} reset={() => { setName('小明'); setGreeting('你好'); setSubPath('greet'); setStatus(null); }}>
      <div className="lab-layout">
        <LabControls className="lab-controls" mode="inline">
          <TextField label="路由参数 name" value={name} onChange={setName} placeholder="路径参数" />
          <TextField label="查询参数 greeting" value={greeting} onChange={setGreeting} placeholder="查询参数" />
          <Select
            label="请求路径"
            value={subPath}
            options={[
              ['greet', 'greet/:name（有效）'],
              ['missing', 'missing/:name（真实 404）'],
            ]}
            onChange={setSubPath}
          />
          <div className="lab-options">
            <button type="button" className="button button--primary button--small" onClick={() => void probe()} disabled={pending}>
              {pending ? '请求中…' : '发送请求'}
            </button>
          </div>
          {name.length > 40 || greeting.length > 40 ? <Status tone="warn">参数超过 40 字符会被截断，避免无意义的超长 URL。</Status> : null}
        </LabControls>

        <div className="lab-stage">
          {status === null ? (
            <Status>点击「发送请求」，下面显示的响应体与响应头都来自真实的 Worker 路由。</Status>
          ) : status.kind === 'error' ? (
            <>
              <ErrorNote>真实响应状态 {status.status ?? '网络错误'}：{status.message}</ErrorNote>
              <p className="lab-status">未知子路由由 Hono 返回 404，非 GET/HEAD 方法返回 405。这里显示的是服务端真实返回的内容。</p>
            </>
          ) : (
            <>
              <Status tone="ok">
                HTTP {status.status} · {status.data.technology} · requestId {status.data.requestId}
              </Status>
              <DataTable
                head={['中间件步骤', '类型']}
                rows={status.data.trace.map((step) => [step, step === 'handler' ? '路由处理函数' : '中间件'])}
                caption="两层中间件与处理函数的真实执行顺序"
              />
              <p className="lab-status">消息：{status.data.message}</p>
            </>
          )}
        </div>
      </div>

      {snippet ? <Code text={snippet} onCopy={onCopy} label="真实请求与响应" maxHeight={260} /> : null}
      {status?.kind === 'ok' ? (
        <Code text={prettyJSON(status.data)} onCopy={onCopy} label="响应 JSON" maxHeight={260} />
      ) : null}
    </Lab>
  );
}
