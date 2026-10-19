import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DemoCopyHandler } from '../types';
import {
  Code,
  DataTable,
  ErrorNote,
  Lab,
  LabLayout,
  Range,
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

/**
 * 严格类型的查询键。
 * queryFn 里读到的就是 SDK 原样交过来的整个 queryKey 数组，
 * 所以键的形状必须和 useQuery 里写的完全一致（元素类型固定、长度固定）。
 */
type MainQueryKey = readonly ['labs', string, number, number];
type DedupeQueryKey = readonly ['labs-dedupe', number, number];

/** queryFn 收到的上下文：整个 queryKey + 由 SDK 提供的 AbortSignal。 */
interface QueryContext {
  queryKey: readonly unknown[];
  signal: AbortSignal;
}

/** 一条真实网络执行记录：queryFn 跑一次就产生一条，状态码由真实响应回填。 */
interface NetEntry {
  id: number;
  scope: 'main' | 'dedupe';
  /** 查询键的字符串形式（可比较、可展示） */
  keyId: string;
  /** 实际发出的 URL —— 与代码片段里显示的字符串逐字符相同 */
  url: string;
  /** 去重实验的轮次；主查询固定为 0 */
  round: number;
  at: number;
  /** null 表示请求还在路上（还没有收到响应） */
  status: number | null;
  error: string | null;
}

type NetInit = Omit<NetEntry, 'id' | 'at' | 'status' | 'error'>;

/** 日志上限：长时间使用也不会无限增长。 */
const LOG_LIMIT = 60;
/** 面板上展示的最近条数。 */
const LOG_VIEW = 12;

const DELAY_OPTIONS: readonly (readonly [string, string])[] = [
  ['0', '0 毫秒（最快）'],
  ['200', '200 毫秒'],
  ['500', '500 毫秒'],
  ['900', '900 毫秒'],
  ['1200', '1200 毫秒'],
];

const DEFAULT_KEY = 'alpha';
const DEFAULT_DELAY = '200';

const PRESET_KEYS = ['alpha', 'beta', 'gamma', 'delta'] as const;

function formatTime(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
}

/** 把查询键序列化成可比较、可展示的字符串。 */
function keyIdOf(key: string, delay: number, fail: boolean): string {
  return `${key}|${delay}|${fail ? 1 : 0}`;
}

/** 唯一的 URL 构造入口：真实请求与代码片段共用它，保证编码完全一致。 */
function buildUrl(key: string, delay: number, fail: boolean): string {
  return `/api/labs/query?key=${encodeURIComponent(key)}&delay=${delay}&fail=${fail ? 1 : 0}`;
}

interface NetApi {
  entries: NetEntry[];
  /** 登记一次 queryFn 执行，返回这条记录的 id（请求中状态为 null）。 */
  record: (init: NetInit) => number;
  /** 用真实响应 / 真实异常回填那条记录。 */
  settle: (id: number, result: { status?: number; error?: string }) => void;
}

/**
 * 请求流水：每个 queryFn 执行一条，硬上限 LOG_LIMIT 条。
 * 计数完全来自 queryFn 的真实调用，没有任何手动 +1。
 */
function useNetLog(): NetApi {
  const [entries, setEntries] = useState<NetEntry[]>([]);
  const entriesRef = useRef<NetEntry[]>([]);
  const seqRef = useRef(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const commit = useCallback((next: NetEntry[]) => {
    entriesRef.current = next.slice(-LOG_LIMIT);
    if (aliveRef.current) setEntries(entriesRef.current);
  }, []);

  const record = useCallback(
    (init: NetInit): number => {
      const id = ++seqRef.current;
      commit([...entriesRef.current, { ...init, id, at: Date.now(), status: null, error: null }]);
      return id;
    },
    [commit],
  );

  const settle = useCallback(
    (id: number, result: { status?: number; error?: string }) => {
      commit(
        entriesRef.current.map((e) =>
          e.id === id ? { ...e, status: result.status ?? e.status, error: result.error ?? null } : e,
        ),
      );
    },
    [commit],
  );

  return { entries, record, settle };
}

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * 主查询面板。
 *
 * 关于 `armed`：查询被 SDK 真实订阅，但初始 armed=false，第一次提交之后才打开。
 * 这样 React 18 StrictMode 在开发模式下的「挂载 → 卸载 → 再挂载」不会把同一次
 * 初始请求执行两遍（第一次会被 SDK 中止），生产与开发看到的请求次数一致。
 */
function QueryBody({ onCopy, net }: { onCopy: DemoCopyHandler; net: NetApi }) {
  const queryClient = useQueryClient();

  const [key, setKey] = useState(DEFAULT_KEY);
  const [delay, setDelay] = useState(DEFAULT_DELAY);
  const [fail, setFail] = useState(false);
  const [retry, setRetry] = useState(0);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setArmed(true);
  }, []);

  const delayMs = Number(delay);
  const cacheKey = keyIdOf(key, delayMs, fail);
  const mainQueryKey: MainQueryKey = useMemo(() => ['labs', key, delayMs, fail ? 1 : 0], [key, delayMs, fail]);
  const url = useMemo(() => buildUrl(key, delayMs, fail), [key, delayMs, fail]);

  /** 真正被发出的 fetch：URL 完全由 SDK 交回的 queryKey 决定。 */
  const fetchLabs = useCallback(
    async ({ queryKey, signal }: QueryContext): Promise<QueryPayload> => {
      const [, k, d, f] = queryKey as MainQueryKey;
      const requestUrl = buildUrl(k, d, f === 1);
      const logId = net.record({ scope: 'main', keyId: keyIdOf(k, d, f === 1), url: requestUrl, round: 0 });
      try {
        const response = await fetch(requestUrl, {
          signal, // 切 key / 卸载都由 SDK 中止在途请求
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        net.settle(logId, { status: response.status });
        if (!response.ok) throw new Error(`后端返回 HTTP ${response.status}（fail=1 的真实故障响应）`);
        return (await response.json()) as QueryPayload;
      } catch (error) {
        if (!signal.aborted) net.settle(logId, { error: error instanceof Error ? error.message : '未知错误' });
        else net.settle(logId, { error: '已中止（切换查询键或组件卸载）' });
        throw error;
      }
    },
    [net],
  );

  const query = useQuery({
    queryKey: mainQueryKey,
    queryFn: fetchLabs,
    enabled: armed,
    retry,
    retryDelay: (attempt: number) => Math.min(1000 * attempt, 3000),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  // ---- 缓存命中判定：完全来自「进入这个键时」观察到的真实 QueryState ----
  // 记录进入当前键的那一刻缓存里有没有数据，以及那一刻已经发出了几次请求；
  // 之后只要新增请求数为 0，就说明 SDK 是直接返回缓存、没有联网。
  const entryRef = useRef<{ key: string; hadData: boolean; baseRequests: number } | null>(null);
  const requestsForKey = (id: string) => net.entries.filter((e) => e.scope === 'main' && e.keyId === id).length;
  if (entryRef.current === null || entryRef.current.key !== cacheKey) {
    const state = queryClient.getQueryState(mainQueryKey);
    entryRef.current = {
      key: cacheKey,
      hadData: (state?.dataUpdatedAt ?? 0) > 0,
      baseRequests: requestsForKey(cacheKey),
    };
  }
  const newRequestsSinceEntry = requestsForKey(cacheKey) - entryRef.current.baseRequests;
  const servedFromCache = entryRef.current.hadData && newRequestsSinceEntry === 0 && !query.isFetching;

  // 「距今多少秒」需要真实时钟推进，所以有一个带清理的定时器。
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['labs', key] });
  };

  const rows = useMemo(() => (query.data?.items ?? []).map((item) => [item.id, item.name, item.category] as const), [query.data]);

  const snippet = useMemo(
    () =>
      [
        `const query = useQuery({`,
        `  queryKey: ['labs', ${JSON.stringify(key)}, ${delayMs}, ${fail ? 1 : 0}],`,
        `  queryFn: async ({ queryKey, signal }) => {`,
        `    const [, k, d, f] = queryKey;   // SDK 原样交回的整个 queryKey`,
        `    const res = await fetch('${url}',`,
        `      { signal, cache: 'no-store' });`,
        `    if (!res.ok) throw new Error('HTTP ' + res.status);`,
        `    return res.json();`,
        `  },`,
        `  retry: ${retry},`,
        `  staleTime: 60_000,   // 60 秒内再回到这个键不会产生新请求`,
        `});`,
        '',
        `// 让这个键下的所有查询重新拉取（活动查询会立即 refetch）`,
        `queryClient.invalidateQueries({ queryKey: ['labs', ${JSON.stringify(key)}] });`,
      ].join('\n'),
    [key, delayMs, fail, retry, url],
  );

  const data = query.data;
  const error = query.error instanceof Error ? query.error.message : null;
  const updatedSecondsAgo = data ? Math.max(0, Math.round((now - query.dataUpdatedAt) / 1000)) : null;

  const statusLine = query.isFetching
    ? '正在发起新的网络请求（fetchStatus = fetching）'
    : query.isError
      ? `上一次响应不是 2xx：真实错误已经进入错误态，缓存里没有这个键的数据（dataUpdatedAt = ${formatTime(query.dataUpdatedAt)}）`
      : query.isPending
        ? '还没有数据'
        : servedFromCache
          ? `命中缓存：进入这个键时缓存里已有数据，本次没有发出任何新请求（staleTime 60 秒）`
          : `本次请求已完成，真实响应已写入缓存（dataUpdatedAt ${formatTime(query.dataUpdatedAt)}）`;

  return (
    <LabLayout
        layout="toolbar"
      controls={
        <>
          <TextField label="查询键 key（最长 40 字符）" value={key} onChange={(v) => setKey(v.slice(0, 40))} placeholder={DEFAULT_KEY} />
          <Select label="服务端延迟 delay" value={delay} options={DELAY_OPTIONS} onChange={setDelay} />
          <div className="lab-options">
            <span className="lab-option">
              <input id="tq-fail" type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
              <label htmlFor="tq-fail">让后端返回 503（fail=1）</label>
            </span>
          </div>
          <Range
            label="失败重试次数 retry"
            value={retry}
            min={0}
            max={3}
            step={1}
            unit=" 次"
            onChange={setRetry}
            hint="retry > 0 时，下面日志里会出现多条针对同一次失败的真实请求。"
          />
          <div className="lab-tq-presets">
            {PRESET_KEYS.map((preset) => (
              <button key={preset} type="button" className="button button--secondary button--small" onClick={() => setKey(preset)}>
                {preset}
              </button>
            ))}
          </div>
          <Status>
            切到别的 key 再切回来：60 秒内不会产生新的网络请求，「本次是否命中缓存」是根据进入键时真实的
            QueryCache 状态算出来的。
          </Status>
        </>
      }
    >
      <div className="lab-tq-body">
        <Stats>
          <Stat label="查询状态" value={query.fetchStatus} />
          <Stat label="isFetching" value={query.isFetching ? 'true' : 'false'} />
          <Stat label="本键真实请求数" value={requestsForKey(cacheKey)} />
        </Stats>

        <p className="lab-tq-note" data-tone={query.isError ? 'error' : servedFromCache ? 'cached' : 'fresh'}>
          {statusLine}
        </p>

        {error ? <ErrorNote onRetry={() => void query.refetch()}>{error}</ErrorNote> : null}
        {error ? (
          <Status tone="warn">
            打开上面的 503 开关可以复现这个真实错误；把 retry 调大能在日志里看到 SDK 自动重试产生的多次真实请求。
          </Status>
        ) : null}

        {query.isPending && !error ? <Status>正在读取真实数据…</Status> : null}

        {data && !error ? (
          <>
            <Stats>
              <Stat
                label="dataUpdatedAt（客户端）"
                value={
                  <span className="lab-tq-mono">
                    {formatTime(query.dataUpdatedAt)}
                    {updatedSecondsAgo === null ? '' : ` · ${updatedSecondsAgo} 秒前`}
                  </span>
                }
              />
              <Stat label="服务端 generatedAt" value={<span className="lab-tq-mono">{data.generatedAt}</span>} />
              <Stat label="条目数 count" value={data.count} />
              <Stat label="requestId" value={<span className="lab-tq-mono">{data.requestId.slice(0, 8)}</span>} />
            </Stats>
            <DataTable
              head={['id', 'name', 'category']}
              rows={rows}
              caption={`来自 D1 的真实结果；服务端 generatedAt ${data.generatedAt}；TanStack 缓存写入时间 dataUpdatedAt ${formatTime(query.dataUpdatedAt)}`}
            />
          </>
        ) : null}

        <div className="lab-options">
          <button type="button" className="button button--primary button--small" onClick={invalidate} disabled={query.isFetching}>
            失效缓存并重新拉取
          </button>
          <button type="button" className="button button--secondary button--small" onClick={() => void query.refetch()} disabled={query.isFetching}>
            重新拉取当前键
          </button>
          <button type="button" className="button button--secondary button--small" onClick={() => setFail(false)} disabled={!fail}>
            关闭故障开关
          </button>
        </div>
        <Status>
          「失效缓存并重新拉取」调用的是 <code>queryClient.invalidateQueries</code>：活动查询会立刻重新请求，
          requestId 与请求计数都会变化；而缓存未过期时切换 key 一次请求都不会多发。
        </Status>

        <Code text={snippet} onCopy={onCopy} label="TanStack Query 调用" maxHeight={260} />
      </div>
    </LabLayout>
  );
}

/** 并发去重实验里的一个观察者：和其余 N-1 个用完全相同的 queryKey。 */
function DedupeCell({
  index,
  batch,
  delayMs,
  enabled,
  fetcher,
}: {
  index: number;
  batch: number;
  delayMs: number;
  enabled: boolean;
  fetcher: (ctx: QueryContext) => Promise<QueryPayload>;
}) {
  const queryKey: DedupeQueryKey = useMemo(() => ['labs-dedupe', batch, delayMs], [batch, delayMs]);
  const { data, isFetching, fetchStatus, isError, error } = useQuery({
    queryKey,
    queryFn: fetcher,
    enabled,
    retry: 0,
    staleTime: 0,
    // 关掉 refetchOnMount：新加入的观察者直接复用已有的同键查询，不会多发一次请求。
    refetchOnMount: false,
    gcTime: 5 * 60_000,
  });
  const state = !enabled ? '待运行' : isError ? 'error' : isFetching ? 'loading' : 'done';
  return (
    <li className="lab-tq-cell" data-state={state}>
      <span className="lab-tq-cell__index">#{index + 1}</span>
      <span className="lab-tq-cell__state">{enabled ? fetchStatus : '待运行'}</span>
      <span className="lab-tq-mono">{isError ? '失败' : (data?.requestId.slice(0, 8) ?? '—')}</span>
      {error instanceof Error ? <span className="lab-tq-cell__err">{error.message}</span> : null}
      {enabled && isFetching ? <span className="lab-tq-cell__hint">同一 queryKey，SDK 只发一次真实请求</span> : null}
      {enabled && !isFetching && !isError ? <span className="lab-tq-cell__hint">复用同一次响应</span> : null}
    </li>
  );
}

/**
 * 去重实验。
 * N 个 DedupeCell 从第一次渲染就挂载（此时 enabled=false，不发请求），
 * 点按钮时只把 batch 加一：所有观察者在同一次提交里切到同一个新 queryKey，
 * TanStack Query 只会真正执行一次 queryFn —— 严格模式下的双挂载也不会多发请求。
 */
function DedupeStage({ onCopy, net }: { onCopy: DemoCopyHandler; net: NetApi }) {
  const [round, setRound] = useState(0);
  const [cellCount, setCellCount] = useState(6);
  const [delayMs, setDelayMs] = useState(400);

  const fetcher = useCallback(
    async ({ queryKey, signal }: QueryContext): Promise<QueryPayload> => {
      const [, batch, delay] = queryKey as DedupeQueryKey;
      const requestUrl = buildUrl('dedupe', delay, false);
      const logId = net.record({ scope: 'dedupe', keyId: keyIdOf('dedupe', delay, false), url: requestUrl, round: batch });
      try {
        const response = await fetch(requestUrl, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
        net.settle(logId, { status: response.status });
        if (!response.ok) throw new Error(`后端返回 HTTP ${response.status}`);
        return (await response.json()) as QueryPayload;
      } catch (error) {
        net.settle(logId, {
          error: signal.aborted ? '已中止（重置或卸载）' : error instanceof Error ? error.message : '未知错误',
        });
        throw error;
      }
    },
    [net],
  );

  // 本轮的请求数：按轮次统计，所以连续跑两轮都是各自的真实值，不会累加。
  const roundEntries = net.entries.filter((e) => e.scope === 'dedupe' && e.round === round);
  const roundRequests = roundEntries.length;
  const roundPending = round > 0 && (roundEntries.length === 0 || roundEntries.some((e) => e.status === null));
  const verdict = round === 0 ? '待运行' : roundPending ? '请求进行中…' : roundRequests === 1 ? '已去重' : `未去重（${roundRequests} 次）`;

  const snippet = useMemo(
    () =>
      [
        `// N 个组件在同一帧里订阅同一个 queryKey`,
        `for (const cell of cells) {`,
        `  useQuery({ queryKey: ['labs-dedupe', ${round}, ${delayMs}], queryFn: fetcher, refetchOnMount: false });`,
        `}`,
        '',
        `// queryFn 只执行一次 → 网络上只有一个 GET ${buildUrl('dedupe', delayMs, false)}`,
      ].join('\n'),
    [round, delayMs],
  );

  return (
    <div className="lab-tq-dedupe">
      <div className="lab-tq-dedupe__head">
        <div>
          <strong>并发去重</strong>
          <p className="lab-tq-dedupe__desc">
            {cellCount} 个观察者在同一次提交里切到同一个 queryKey（键里带轮次，方便每轮重新拉一次）。
            TanStack Query 只会执行一次 queryFn，所有观察者拿到同一个 requestId。
          </p>
        </div>
        <div className="lab-tq-dedupe__controls">
          <Range
            label="并发组件数"
            value={cellCount}
            min={2}
            max={10}
            step={1}
            unit=" 个"
            onChange={(n) => {
              setCellCount(n);
              setRound(0);
            }}
          />
          <Range
            label="服务端延迟"
            value={delayMs}
            min={0}
            max={1200}
            step={100}
            unit=" 毫秒"
            onChange={(n) => {
              setDelayMs(n);
              setRound(0);
            }}
          />
          <button type="button" className="button button--primary button--small" onClick={() => setRound((r) => r + 1)}>
            同时挂载 {cellCount} 个查询（第 {round + 1} 轮）
          </button>
        </div>
      </div>
      <Stats>
        <Stat label="并发组件数" value={cellCount} />
        <Stat label="本轮真实请求" value={round === 0 ? '—' : roundRequests} />
        <Stat label="结果" value={verdict} />
        <Stat label="轮次" value={round} />
      </Stats>
      <ul className="lab-tq-cells">
        {Array.from({ length: cellCount }, (_, i) => (
          <DedupeCell key={i} index={i} batch={round} delayMs={delayMs} enabled={round > 0} fetcher={fetcher} />
        ))}
      </ul>
      <Status>
        计数按轮次统计，每轮从 0 开始：连点两次按钮，两轮的「本轮真实请求」都会是各自真实的 1 次。
      </Status>
      <Code text={snippet} onCopy={onCopy} label="去重实验调用" maxHeight={200} />
    </div>
  );
}

/** 请求流水面板：只展示真实的 queryFn 执行记录。 */
function NetLog({ entries }: { entries: NetEntry[] }) {
  const rows = useMemo(
    () =>
      entries
        .slice(-LOG_VIEW)
        .reverse()
        .map((e) => [
          formatTime(e.at),
          e.scope === 'dedupe' ? `去重·第${e.round}轮` : '主查询',
          <span className="lab-tq-mono">{e.keyId}</span>,
          <span className="lab-tq-status" data-ok={e.status !== null && e.status < 400}>
            {e.error ? e.error : (e.status ?? '请求中')}
          </span>,
          <span className="lab-tq-url">{e.url}</span>,
        ]),
    [entries],
  );

  return (
    <div className="lab-tq-log">
      <div className="lab-tq-log__head">
        <h3>请求流水（queryFn 的真实执行）</h3>
        <span className="lab-tq-round" data-active={entries.length > 0}>
          共 {entries.length} 条 / 上限 {LOG_LIMIT}
        </span>
      </div>
      {entries.length === 0 ? (
        <Status>还没有发出任何请求。</Status>
      ) : (
        <DataTable head={['时间', '来源', '查询键', '结果', '实际请求 URL']} rows={rows} caption={`最近 ${LOG_VIEW} 条真实网络请求（超出上限会丢弃最旧的记录）`} />
      )}
    </div>
  );
}

/** 一次「实验实例」：重置时整棵子树被重新挂载，所有内部状态都会回到默认值。 */
function LabSession({ onCopy }: { onCopy: DemoCopyHandler }) {
  const net = useNetLog();
  return (
    <>
      <QueryBody onCopy={onCopy} net={net} />
      <DedupeStage onCopy={onCopy} net={net} />
      <NetLog entries={net.entries} />
    </>
  );
}

/**
 * TanStack Query 展示台。
 * QueryClientProvider 的 client 在重置时被整体换掉，组件卸载时清空缓存，
 * 因此不会污染应用里的其它查询。
 */
export default function TanstackQueryLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [client, setClient] = useState(createClient);
  const [epoch, setEpoch] = useState(0);

  // 卸载时清空这个 demo 私有的 QueryClient。
  useEffect(() => {
    return () => {
      client.clear();
    };
  }, [client]);

  const reset = () => {
    client.clear();
    // 换一个新的空 QueryClient + 换一棵子树：控件回到默认值、计数与日志清空，
    // 随后主查询会真的发出一次全新的首请求。
    setClient(createClient());
    setEpoch((n) => n + 1);
  };

  return (
    <Lab title="TanStack Query 服务端状态" badge={<span className="demo-live-badge">@tanstack/react-query 5</span>} reset={reset}>
      <QueryClientProvider client={client}>
        <LabSession key={epoch} onCopy={onCopy} />
      </QueryClientProvider>
    </Lab>
  );
}
