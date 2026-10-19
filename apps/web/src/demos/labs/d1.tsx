import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Segmented, Select, Stat, Stats, Status } from '../lab-kit';

type View = 'orders' | 'summary' | 'ranking';
type Region = 'all' | '华东' | '华南' | '华北' | '西部';
type StatusFilter = 'all' | 'paid' | 'pending' | 'refunded';

/** 真实后端返回体（GET /api/labs/d1）。 */
interface D1OrderRow {
  orderId: string;
  customerId: string;
  region: string;
  status: string;
  totalCents: number;
  orderedAt: string;
}
interface D1SummaryRow {
  region: string;
  orderCount: number;
  totalCents: number;
  averageCents: number;
}
interface D1RankingRow {
  orderId: string;
  region: string;
  totalCents: number;
  regionRank: number;
}
type D1Row = Partial<D1OrderRow & D1SummaryRow & D1RankingRow>;

interface D1Response {
  technology: string;
  sql: string;
  parameters: unknown[];
  rows: D1Row[];
  durationMs: number;
  source: string;
}

const VIEWS: readonly (readonly [View, string])[] = [
  ['orders', '订单明细'],
  ['summary', '按地区聚合'],
  ['ranking', '地区内排名'],
];

const REGIONS: readonly (readonly [Region, string])[] = [
  ['all', '全部地区'],
  ['华东', '华东'],
  ['华南', '华南'],
  ['华北', '华北'],
  ['西部', '西部'],
];

const STATUSES: readonly (readonly [StatusFilter, string])[] = [
  ['all', '全部状态'],
  ['paid', '已支付'],
  ['pending', '待支付'],
  ['refunded', '已退款'],
];

const STATUS_LABEL: Record<string, string> = {
  paid: '已支付',
  pending: '待支付',
  refunded: '已退款',
};

/** 金额一律是整数分，展示时才换算，避免浮点误差。 */
function yuan(cents: number | undefined): string {
  if (typeof cents !== 'number') return '—';
  return `¥${(cents / 100).toFixed(2)}`;
}

function headFor(view: View): readonly string[] {
  if (view === 'summary') return ['地区', '订单数', '合计金额', '平均金额'];
  if (view === 'ranking') return ['订单号', '地区', '金额', '地区内排名'];
  return ['订单号', '客户', '地区', '状态', '金额', '下单日期'];
}

function cell(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/**
 * Cloudflare D1：固定 SQL 模板 + 绑定参数在真实 D1 上执行。
 * 返回的 sql / parameters / rows / durationMs 全部来自服务端，页面不做任何客户端筛选。
 */
export default function D1Lab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [view, setView] = useState<View>('orders');
  const [region, setRegion] = useState<Region>('all');
  const [status, setStatus] = useState<StatusFilter>('paid');

  const [data, setData] = useState<D1Response | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const url = `/api/labs/d1?view=${view}&region=${encodeURIComponent(region)}&status=${status}`;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    setLoading(true);
    setErrorText(null);

    fetch(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status} · ${body.slice(0, 200)}`);
        }
        return (await response.json()) as D1Response;
      })
      .then((payload) => {
        if (!mountedRef.current || controller.signal.aborted) return;
        setData(payload);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || controller.signal.aborted) return;
        setData(null);
        setErrorText(error instanceof Error ? error.message : String(error));
        setLoading(false);
      });

    return () => controller.abort();
  }, [view, region, status, nonce]);

  const rows = useMemo(() => {
    if (!data) return [] as ReactNode[][];
    if (view === 'summary') {
      return data.rows.map((row) => [row.region ?? '—', row.orderCount ?? 0, yuan(row.totalCents), yuan(row.averageCents)]);
    }
    if (view === 'ranking') {
      return data.rows.map((row) => [row.orderId ?? '—', row.region ?? '—', yuan(row.totalCents), `#${row.regionRank ?? '—'}`]);
    }
    return data.rows.map((row) => [
      row.orderId ?? '—',
      row.customerId ?? '—',
      row.region ?? '—',
      cell(row.status ?? ''),
      yuan(row.totalCents),
      row.orderedAt ?? '—',
    ]);
  }, [data, view]);

  const totalCents = useMemo(() => (data ? data.rows.reduce((sum, row) => sum + (typeof row.totalCents === 'number' ? row.totalCents : 0), 0) : 0), [data]);

  const code = useMemo(() => {
    if (!data) return '（等待响应）';
    return [`-- 来源表：${data.source}`, `-- 绑定参数：${JSON.stringify(data.parameters)}`, data.sql].join('\n');
  }, [data]);

  return (
    <Lab
      title="Cloudflare D1 固定查询模板"
      badge={<span className="demo-live-badge">D1 · {data?.technology ?? 'Cloudflare D1'}</span>}
      reset={() => {
        setView('orders');
        setRegion('all');
        setStatus('paid');
        setNonce((n) => n + 1);
      }}
    >
      <LabLayout
        layout="toolbar"
        controls={
          <>
            <Segmented<View> label="视图 view" value={view} options={VIEWS} onChange={setView} />
            <Select<Region> label="地区 region" value={region} options={REGIONS} onChange={setRegion} />
            <Select<StatusFilter> label="状态 status" value={status} options={STATUSES} onChange={setStatus} />
            <div className="lab-options">
              <button type="button" className="button button--secondary button--small" onClick={() => setNonce((n) => n + 1)}>
                重新执行
              </button>
            </div>
            <Status>
              页面不做任何客户端筛选：切换条件后是带新参数重新向 D1 发一次查询，返回的 rows 完全由服务端 SQL 决定。
            </Status>
          </>
        }
      >
        <div className="lab-d1-body">
          <Stats>
            <Stat label="返回行数" value={data ? data.rows.length : '—'} />
            <Stat label="绑定参数" value={data ? data.parameters.length : '—'} />
            <Stat label="D1 执行耗时" value={data ? `${data.durationMs} ms` : '—'} />
          </Stats>

          {loading ? <Status>正在 D1 上执行固定 SQL 模板…</Status> : null}
          {errorText ? <ErrorNote onRetry={() => setNonce((n) => n + 1)}>{errorText}</ErrorNote> : null}

          {data ? (
            <>
              <Code text={code} onCopy={onCopy} label="D1 编译后的 SQL" maxHeight={200} />
              <DataTable
                head={headFor(view)}
                rows={rows}
                caption={`虚构的示例订单数据（表 ${data.source}），金额单位为整数分；耗时 ${data.durationMs} ms 由服务端测量。`}
              />
              <Stats>
                <Stat label="本页合计金额" value={yuan(totalCents)} />
                <Stat label="数据表" value={data.source} />
                <Stat label="技术栈标记" value={data.technology} />
              </Stats>
              <Status>所有订单均为本站在 D1 中预置的虚构示例数据，不包含任何真实用户或交易信息。</Status>
            </>
          ) : null}
        </div>
      </LabLayout>
    </Lab>
  );
}
