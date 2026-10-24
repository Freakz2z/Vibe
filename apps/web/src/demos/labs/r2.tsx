import { apiUrl, IS_TOY } from '../../lib/runtime';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Range, Stat, Stats, Status } from '../lab-kit';

const OBJECT_URL = apiUrl('/api/labs/r2');

interface HeadInfo {
  status: number;
  contentLength: string;
  contentType: string;
  etag: string;
  acceptRanges: string;
  objectKey: string;
}

interface FetchReport {
  label: string;
  requestHeaders: string;
  status: number;
  statusText: string;
  responseHeaders: [string, string][];
  bytes: number;
  hex: string;
  note: string;
}

function headersToPairs(headers: Headers): [string, string][] {
  const out: [string, string][] = [];
  headers.forEach((value, name) => {
    if (name.startsWith('x-') || name.startsWith('content-') || name === 'etag' || name === 'accept-ranges') {
      out.push([name, value]);
    }
  });
  return out;
}

function toHex(buffer: ArrayBuffer, limit = 64): string {
  const bytes = new Uint8Array(buffer);
  const slice = bytes.subarray(0, limit);
  const lines: string[] = [];
  for (let offset = 0; offset < slice.length; offset += 16) {
    const chunk = Array.from(slice.subarray(offset, offset + 16));
    const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.padEnd(47, ' ')}  ${ascii}`);
  }
  if (bytes.length > limit) lines.push(`… 共 ${bytes.length} 字节，此处只显示前 ${limit} 字节`);
  return lines.join('\n');
}

/**
 * Cloudflare R2：真实的 HTTP 读取语义。
 * HEAD 元数据、条件请求（304）、Range 分段（206 / 416）全部来自真实对象存储。
 * 这里没有上传，也没有对象列表 —— R2 在这个 demo 里是只读的。
 *
 * 并发约定（与 drizzle.tsx 一致）：
 * - 每次请求都新建 AbortController 并顶掉上一个；
 * - 任何 setState 之前都要确认 `controllerRef.current === controller` 且
 *   `!controller.signal.aborted`，否则旧响应会覆盖新状态，或在卸载后写状态。
 */
export default function R2Lab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [head, setHead] = useState<HeadInfo | null>(null);
  const [headStatus, setHeadStatus] = useState<number | null>(null);
  const [headError, setHeadError] = useState<string | null>(null);
  const [reports, setReports] = useState<FetchReport[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rangeEnd, setRangeEnd] = useState(63);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  /** 只释放 blob URL，不碰 React state（卸载时不能 setState）。 */
  const revokeImage = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  /** 释放 blob URL 的同时清掉 state，避免 UI 继续显示一张已经被撤销的预览。 */
  const clearImage = useCallback(() => {
    revokeImage();
    setImageUrl(null);
  }, [revokeImage]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
      revokeImage();
    };
  }, [revokeImage]);

  const loadHead = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setHeadError(null);
    try {
      const response = await fetch(apiUrl(OBJECT_URL), { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
      // 竞态守卫：只有最新的一次请求可以写状态。
      if (controller.signal.aborted || controllerRef.current !== controller || !mountedRef.current) return;
      setHeadStatus(response.status);
      if (!response.ok) {
        // 失败就是失败：绝不把 503 的响应头当成成功的元数据展示。
        setHead(null);
        setHeadError(`HEAD 请求失败：HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`);
        return;
      }
      setHead({
        status: response.status,
        contentLength: response.headers.get('Content-Length') ?? '（缺失）',
        contentType: response.headers.get('Content-Type') ?? '（缺失）',
        etag: response.headers.get('ETag') ?? '（缺失）',
        acceptRanges: response.headers.get('Accept-Ranges') ?? '（缺失）',
        objectKey: response.headers.get('X-Object-Key') ?? '（缺失）',
      });
    } catch (error) {
      if (controller.signal.aborted || controllerRef.current !== controller || !mountedRef.current) return;
      setHead(null);
      setHeadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  // 挂载即读一次真实元数据。
  useEffect(() => {
    void loadHead();
    return () => {
      controllerRef.current?.abort();
    };
  }, [loadHead]);

  /** 条件 GET / Range GET / 完整 GET，全部走真实 fetch。 */
  const run = useCallback(
    async (label: string, headers: Record<string, string>, note: string, wantBytes: boolean, wantImage: boolean) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setBusy(true);
      setErrorText(null);
      // 撤销旧图并同步清空 state：不能留下一张已撤销的预览。
      clearImage();
      try {
        const response = await fetch(apiUrl(OBJECT_URL), { method: 'GET', headers, signal: controller.signal, cache: 'no-store' });
        const buffer = await response.arrayBuffer();
        if (controller.signal.aborted || controllerRef.current !== controller || !mountedRef.current) return;

        // 只有响应真的到了之后才创建 object URL。
        if (wantImage && response.status === 200) {
          const url = URL.createObjectURL(new Blob([buffer], { type: response.headers.get('Content-Type') ?? 'application/octet-stream' }));
          objectUrlRef.current = url;
          setImageUrl(url);
        }

        const report: FetchReport = {
          label,
          requestHeaders: Object.entries(headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n') || '（无）',
          status: response.status,
          statusText: response.statusText,
          responseHeaders: headersToPairs(response.headers),
          bytes: buffer.byteLength,
          hex: wantBytes ? toHex(buffer) : '',
          note,
        };
        setReports((prev) => [report, ...prev].slice(0, 6));
      } catch (error) {
        if (controller.signal.aborted || controllerRef.current !== controller || !mountedRef.current) return;
        setErrorText(error instanceof Error ? error.message : String(error));
      } finally {
        // 只有仍然有效的这次请求才能清掉 busy。
        if (!controller.signal.aborted && controllerRef.current === controller && mountedRef.current) setBusy(false);
      }
    },
    [clearImage],
  );

  const etag = head?.etag && head.etag.startsWith('（') ? '' : (head?.etag ?? '');
  const totalBytes = Number(head?.contentLength ?? 0);

  const loadFullImage = useCallback(() => {
    void run('GET（完整对象）', {}, '完整取回 brand/logo.png 的全部字节。', true, true);
  }, [run]);

  /**
   * 重置：中止所有在途请求、清掉 busy、清空报告与图片，然后**真正重新发起** HEAD 请求
   * （这样即使之前 HEAD 失败、当前已经处于默认值，重置也依然是一次真实请求）。
   */
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setBusy(false);
    setReports([]);
    setErrorText(null);
    setHead(null);
    setHeadStatus(null);
    setHeadError(null);
    setRangeEnd(63);
    clearImage();
    void loadHead();
  }, [clearImage, loadHead]);

  return (
    <Lab
      title="Cloudflare R2 对象读取"
      badge={<span className="demo-live-badge">R2 · brand/logo.png</span>}
      reset={reset}
    >
      <LabLayout
        controls={
          <>
            <div className="lab-field">
              <span>对象元数据（HEAD）</span>
              <div className="lab-options">
                <button type="button" className="button button--primary button--small" onClick={() => void loadHead()}>
                  发送 HEAD 请求
                </button>
              </div>
            </div>
            {headError ? <ErrorNote onRetry={() => void loadHead()}>{headError}</ErrorNote> : null}
            {head ? (
              <Status tone="ok">
                {head.objectKey} · {head.contentLength} 字节 · {head.contentType}
              </Status>
            ) : null}

            <Range label="分段读取结束位置" value={rangeEnd} min={15} max={1023} step={16} unit="" onChange={setRangeEnd} hint={`请求头 Range: bytes=0-${rangeEnd}，由服务端返回 206 与 Content-Range。`} />

            <div className="lab-options">
              <button
                type="button"
                className="button button--secondary button--small"
                disabled={!etag || busy}
                onClick={() => void run('GET + If-None-Match（条件请求）', { 'If-None-Match': etag }, 'ETag 与对象一致，R2 返回 304 Not Modified，不含响应体。', false, false)}
              >
                条件 GET（期望 304）
              </button>
            </div>
            <div className="lab-options">
              <button
                type="button"
                className="button button--secondary button--small"
                disabled={busy}
                onClick={() => void run(`GET + Range: bytes=0-${rangeEnd}`, { Range: `bytes=0-${rangeEnd}` }, '合法范围：R2 返回 206 Partial Content 与 Content-Range。', true, false)}
              >
                分段 GET（期望 206）
              </button>
              <button
                type="button"
                className="button button--secondary button--small"
                disabled={busy || totalBytes === 0}
                onClick={() => {
                  const start = totalBytes + 1000;
                  void run(`GET + Range: bytes=${start}-${start + 63}`, { Range: `bytes=${start}-${start + 63}` }, '范围超出对象长度：R2 返回 416 Range Not Satisfiable，Content-Range 为 bytes */总长度。', false, false);
                }}
              >
                越界 Range（期望 416）
              </button>
            </div>
            <div className="lab-options">
              <button type="button" className={`button ${IS_TOY ? 'button--primary' : 'button--secondary'} button--small`} disabled={busy} onClick={loadFullImage}>
                取回完整对象并渲染
              </button>
            </div>
            <Status>
              读取同一对象，比较条件请求与分段请求的响应。
            </Status>
          </>
        }
      >
        <div className="lab-r2-body">
          <Stats>
            <Stat label="HTTP 状态" value={headStatus ?? '—'} />
            <Stat label="Content-Length" value={head ? head.contentLength : '—'} />
            <Stat label="Accept-Ranges" value={head ? head.acceptRanges : '—'} />
          </Stats>
          <Stats>
            <Stat label="Content-Type" value={head ? head.contentType : '—'} />
            <Stat label="ETag" value={<span className="lab-r2-mono">{head ? head.etag : '—'}</span>} />
            <Stat label="X-Object-Key" value={<span className="lab-r2-mono">{head ? head.objectKey : '—'}</span>} />
          </Stats>

          {busy ? <Status>请求进行中…</Status> : null}
          {errorText ? <ErrorNote>{errorText}</ErrorNote> : null}

          {imageUrl ? (
            <div className="lab-r2-image">
              <img src={imageUrl} alt="从 R2 完整取回的 brand/logo.png" width={96} height={96} />
              <small>上面这张图就是刚才完整取回的 {head ? head.contentLength : ''} 字节 PNG。</small>
            </div>
          ) : null}

          {reports.length === 0 ? (
            <Status>还没有发起 GET 请求。选择上方请求，查看响应头和返回字节。</Status>
          ) : (
            reports.map((report, index) => (
              <div className="lab-r2-report" key={`${report.label}-${index}`} data-status={report.status}>
                <div className="lab-r2-report__head">
                  <strong>{report.label}</strong>
                  <span>
                    {report.status} {report.statusText} · {report.bytes} 字节
                  </span>
                </div>
                <DataTable
                  head={['响应头', '值']}
                  rows={report.responseHeaders.map(([name, value]) => [<span className="lab-r2-mono">{name}</span>, value])}
                  caption={`请求头：${report.requestHeaders.replaceAll('\n', ' ｜ ')}`}
                />
                <p className="lab-r2-report__note">{report.note}</p>
                {report.hex ? (
                  <Code
                    text={report.hex}
                    onCopy={onCopy}
                    output label={`响应字节（${report.bytes} 字节）`}
                    maxHeight={200}
                  />
                ) : null}
              </div>
            ))
          )}
        </div>
      </LabLayout>
    </Lab>
  );
}
