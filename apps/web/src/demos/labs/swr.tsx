import { apiUrl } from '../../lib/runtime';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { SWRConfig } from 'swr';
import type { DemoCopyHandler } from '../types';
import {
  Code,
  DataTable,
  ErrorNote,
  Lab,
  LabLayout,
  Select,
  Stat,
  Stats,
  Status,
  TextField,
} from '../lab-kit';

/** 真实后端返回体（GET /api/labs/query）。 */
interface QueryItem {
  id: string;
  name: string;
  category: string;
}
interface QueryPayload {
  key: string;
  requestId: string;
  generatedAt: string;
  items: QueryItem[];
  count: number;
}

const DELAY_OPTIONS: readonly (readonly [string, string])[] = [
  ['0', '0 毫秒（最快）'],
  ['400', '400 毫秒'],
  ['900', '900 毫秒'],
  ['1200', '1200 毫秒'],
];

const PRESET_KEYS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'] as const;

interface RequestRecord {
  cacheKey: string;
  status: number;
  at: number;
}

function buildUrl(key: string, delay: number, fail: boolean): string {
  return apiUrl(`/api/labs/query?key=${encodeURIComponent(key)}&delay=${delay}&fail=${fail ? 1 : 0}`);
}

/**
 * SWR：stale-while-revalidate。
 * 切键时旧数据留在屏幕上（keepPreviousData），窗口重新获得焦点会自动重新验证，
 * 请求计数器在每次真实响应到达时 +1。
 */
export default function SwrLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  // Each visit owns its cache. An aborted request from an unmounted demo must
  // not become the next visit's initial cached error.
  const config = useMemo(() => ({ provider: () => new Map() }), []);
  return <SWRConfig value={config}><SwrSession onCopy={onCopy} /></SWRConfig>;
}

function SwrSession({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [key, setKey] = useState('alpha');
  const [delay, setDelay] = useState('900');
  const [fail, setFail] = useState(false);
  const [focusPulse, setFocusPulse] = useState(0);
  const [logs, setLogs] = useState<RequestRecord[]>([]);

  const delayMs = Number(delay);
  const trimmed = key.trim();

  /** SWR 的 key 同时决定缓存条目与请求地址。 */
  const swrKey = useMemo(() => (trimmed ? buildUrl(trimmed, delayMs, fail) : null), [trimmed, delayMs, fail]);

  const mountedRef = useRef(true);
  const controllersRef = useRef<Set<AbortController>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // SWR 自己不做取消，这里把本次会话里所有在途请求中止掉。
      controllersRef.current.forEach((c) => c.abort());
      controllersRef.current.clear();
    };
  }, []);

  /** 每次真实响应（含 4xx/5xx）到达后计数 +1，不是每次渲染。 */
  const fetcher = useCallback(async (url: string) => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    try {
      const response = await fetch(apiUrl(url), { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
      if (mountedRef.current) {
        setLogs((prev) => [...prev, { cacheKey: url, status: response.status, at: Date.now() }].slice(-40));
      }
      if (!response.ok) throw new Error(`后端返回 HTTP ${response.status}`);
      return (await response.json()) as QueryPayload;
    } finally {
      controllersRef.current.delete(controller);
    }
  }, []);

  const { data, error, isLoading, isValidating, mutate } = useSWR<QueryPayload, Error>(swrKey, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: false,
    dedupingInterval: 0,
    shouldRetryOnError: false,
  });

  // 真实的焦点事件：SWR 的 revalidateOnFocus 就是被它触发的。
  useEffect(() => {
    const onFocus = () => setFocusPulse((n) => n + 1);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setFocusPulse((n) => n + 1);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const forKey = swrKey ? logs.filter((l) => l.cacheKey === swrKey).length : logs.length;
  const lastFailed = logs.length > 0 && logs[logs.length - 1].status >= 400;

  /** keepPreviousData 的真实证据：屏幕上的数据还属于上一个 key。 */
  const staleData = Boolean(data && trimmed && data.key !== trimmed);
  const errorText = error instanceof Error ? error.message : null;

  const rows = useMemo(() => (data?.items ?? []).map((item) => [item.id, item.name, item.category] as const), [data]);

  const snippet = useMemo(
    () =>
      [
        `const { data, error, isLoading, isValidating, mutate } = useSWR(`,
        `  ${swrKey ? `'${swrKey}'` : 'null'},`,
        `  fetcher,`,
        `  {`,
        `    keepPreviousData: true,   // 切 key 时保留旧数据，不闪空白`,
        `    revalidateOnFocus: true,   // 窗口重新获得焦点时自动重新验证`,
        `    dedupingInterval: 0,
    shouldRetryOnError: false,       // 关掉去重窗口，方便看清每一次真实请求`,
        `  },`,
        `);`,
        '',
        `// 手动重新验证（等价于窗口焦点触发的自动行为）`,
        `await mutate();`,
      ].join('\n'),
    [swrKey],
  );

  const logRows = useMemo(
    () =>
      logs
        .slice(-12)
        .reverse()
        .map((log) => [
          new Date(log.at).toLocaleTimeString('zh-CN', { hour12: false }),
          log.status,
          <span className="lab-swr-mono">{log.cacheKey}</span>,
        ]),
    [logs],
  );

  return (
    <Lab title="SWR 陈旧数据重验证" badge={<span className="demo-live-badge">swr 2.2.5</span>} reset={() => {controllersRef.current.forEach(c => c.abort()); setKey('alpha'); setDelay('900'); setFail(false); setFocusPulse(0); setLogs([]); if (key === 'alpha' && delay === '900' && !fail) void mutate(undefined, {revalidate: true});}}>
      <LabLayout
        layout="toolbar"
        controls={
          <>
            <TextField label="缓存键 key" value={key} onChange={(v) => setKey(v.slice(0, 40))} placeholder="alpha" />
            <Select label="服务端延迟 delay" value={delay} options={DELAY_OPTIONS} onChange={setDelay} />
            <div className="lab-options">
              <span className="lab-option">
                <input id="swr-fail" type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
                <label htmlFor="swr-fail">让后端返回 503（fail=1）</label>
              </span>
            </div>
            <div className="lab-swr-presets">
              {PRESET_KEYS.map((preset) => (
                <button key={preset} type="button" className="button button--secondary button--small" onClick={() => setKey(preset)}>
                  {preset}
                </button>
              ))}
            </div>
            <Status>
              切换上面任意一个 key：SWR 会把上一个 key 的数据留在屏幕上继续显示，直到新响应回来。
              这是 SWR 与「切键即清空」写法最直观的差别。
            </Status>
          </>
        }
      >
        <div className="lab-swr-body">
          <Stats>
            <Stat label="isLoading" value={isLoading ? 'true' : 'false'} />
            <Stat label="isValidating" value={isValidating ? 'true' : 'false'} />
            <Stat label="真实响应次数" value={forKey} />
          </Stats>

          <p className="lab-swr-note" data-tone={staleData ? 'stale' : 'fresh'}>
            {staleData
              ? `屏幕上显示的是上一次请求的数据（key = ${data?.key}），新数据还在路上。`
              : isValidating
                ? '正在后台重新验证，屏幕上的数据仍然可用。'
                : '屏幕上的数据与当前 key 一致。'}
          </p>

          {errorText ? <ErrorNote onRetry={() => void mutate()}>{errorText}</ErrorNote> : null}

          {isLoading && !data ? <Status>首次加载中，还没有可显示的数据…</Status> : null}

          <Stats>
            <Stat label="数据里的 key" value={data?.key ?? '—'} />
            <Stat label="requestId" value={<span className="lab-swr-mono">{data?.requestId.slice(0, 8) ?? '—'}</span>} />
            <Stat label="窗口焦点事件" value={focusPulse} />
          </Stats>

          <DataTable head={['id', 'name', 'category']} rows={rows} caption={data ? `后端 generatedAt ${data.generatedAt}（真实 D1 数据）` : undefined} />

          <div className="lab-options">
            <button type="button" className="button button--primary button--small" onClick={() => void mutate()} disabled={!swrKey}>
              mutate() 手动重新验证
            </button>
          </div>
          <Status>
            {lastFailed ? '上一次响应不是 2xx。' : '想看自动重新验证？切到别的浏览器标签页再切回来即可。'} 每次真实响应都会让「真实响应次数」+1，
            焦点计数来自真实的 window focus / visibilitychange 事件。
          </Status>
        </div>
      </LabLayout>

      <div className="lab-swr-log">
        <h3>请求流水（由真实 fetch 响应驱动）</h3>
        {logs.length === 0 ? (
          <Status>还没有收到任何响应。</Status>
        ) : (
          <DataTable head={['时间', '状态', '请求 URL']} rows={logRows} caption="最近 12 条真实网络请求" />
        )}
      </div>

      <Code text={snippet} onCopy={onCopy} label="SWR 调用" />
    </Lab>
  );
}
