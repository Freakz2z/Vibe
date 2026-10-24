import { LabControls } from '../lab-kit';
import { apiUrl } from '../../lib/runtime';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, Range, Select, Status, prettyJSON } from '../lab-kit';

interface KyselyRow {
  region: string;
  orderCount: number;
  totalCents: number;
}

interface KyselyResponse {
  technology: 'Kysely';
  sql: string;
  parameters: unknown[];
  rows: KyselyRow[];
  source: string;
}

const REGIONS = ['all', '华东', '华南', '华北', '西部'] as const;

/**
 * Kysely: a composable aggregate query compiled on the server and executed on
 * D1. Changing `minimum` moves the HAVING threshold, so the generated SQL and
 * the returned rows genuinely change.
 */
export default function KyselyLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [region, setRegion] = useState<string>('all');
  const [minimum, setMinimum] = useState(0);
  const [data, setData] = useState<KyselyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [nonce, setNonce] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({ region, minimum: String(minimum) });
      const response = await fetch(apiUrl(`/api/labs/kysely?${params}`), { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`);
      const payload = (await response.json()) as KyselyResponse;
      if (controller.signal.aborted) return;
      setData(payload);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      if (!controller.signal.aborted && controllerRef.current === controller) setPending(false);
    }
  }, [region, minimum, nonce]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return (
    <Lab
      title="Kysely 组合聚合查询"
      badge={<span className="demo-live-badge">Cloudflare D1</span>}
      reset={() => {
        controllerRef.current?.abort();
        setRegion('all');
        setMinimum(0);
        setNonce((n) => n + 1);
      }}
    >
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <Select label="地区 region" value={region} options={REGIONS.map((r) => [r, r === 'all' ? '全部' : r])} onChange={setRegion} />
          <Range
            label="最低金额门槛"
            value={minimum}
            min={0}
            max={100000}
            step={1000}
            unit=" 分"
            onChange={setMinimum}
            hint="对应 SQL 的 HAVING sum(total_cents) >= ?"
          />
          <p className="lab-field__rule">门槛提高到较高数值时，部分地区会被 HAVING 过滤掉，可以看到返回行数真实减少。</p>
        </LabControls>

        <div className="lab-stage">
          {error ? <ErrorNote onRetry={() => void load()}>{error}</ErrorNote> : null}
          {pending ? <Status>查询中…</Status> : null}
          {data ? (
            data.rows.length === 0 ? (
              <Status>当前门槛下没有地区满足条件，SQL 依然会返回空结果集。</Status>
            ) : (
              <DataTable
                head={['地区', '订单数', '合计（分）', '合计（元）']}
                rows={data.rows.map((row) => [row.region, row.orderCount, row.totalCents.toLocaleString('zh-CN'), (row.totalCents / 100).toFixed(2)])}
                caption="按地区聚合的示例订单数据"
              />
            )
          ) : null}
        </div>
      </div>

      {data ? (
        <>
          <Code text={`${data.sql}\n\n-- 绑定参数\n${prettyJSON(data.parameters)}`} onCopy={onCopy} label="Kysely 编译出的 SQL" maxHeight={260} />
          <Code text={prettyJSON(data.rows)} onCopy={onCopy} label="响应 rows" maxHeight={240} />
        </>
      ) : null}
    </Lab>
  );
}
