import { IS_TOY, apiUrl, API_ORIGIN, routeHref } from '../../lib/runtime';
import { useCallback, useEffect, useRef, useState } from 'react';
import htmx from 'htmx.org';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, LabLayout, Stat, Stats, Status } from '../lab-kit';

// 明确关闭：htmx 换回来的内容不允许执行表达式，也不允许插入 <script>。
// 片段来自本站自己的后端，属于可信来源，但配置本身仍然拒绝这两类内容。
htmx.config.allowEval = false;
htmx.config.allowScriptTags = false;
// 只允许同源请求，杜绝任何人往 hx-get 里塞外站地址。
htmx.config.selfRequestsOnly = !IS_TOY;
htmx.config.withCredentials = false;

/**
 * 这段标记由 htmx 全权接管：请求、解析 HTML、替换 DOM 全部是 htmx 自己做的。
 * React 只在挂载时调用一次 htmx.process()，之后不再碰这块 DOM。
 */
const MARKUP = [
  '<form class="lab-htmx__form"',
  ' hx-get="/api/labs/htmx/search"',
  ' hx-trigger="input changed delay:300ms from:#lab-htmx-q, search, submit"',
  ' hx-target="#lab-htmx-results"',
  ' hx-swap="innerHTML"',
  ' hx-indicator="#lab-htmx-busy">',
  '  <input id="lab-htmx-q" class="lab-htmx__input" type="search" name="q" maxlength="80" autocomplete="off"',
  '    placeholder="输入工具关键词，例如 html / react / vitest" aria-label="工具搜索关键词" />',
  '  <button type="submit" class="button button--secondary button--small">立即搜索</button>',
  '  <button type="button" class="button button--secondary button--small"',
  '    hx-get="/api/labs/htmx/search?q=htmx" hx-trigger="click"',
  '    hx-target="#lab-htmx-results" hx-swap="innerHTML">载入示例：htmx</button>',
  '  <span id="lab-htmx-busy" class="lab-htmx__busy htmx-indicator" aria-live="polite">请求中…</span>',
  '</form>',
  '<div id="lab-htmx-results" class="lab-htmx__results">',
  '  <p class="lab-htmx__hint">还没有发过请求。在上方输入内容，htmx 会自己发 GET 请求，并把后端返回的 HTML 片段换进这里。</p>',
  '</div>',
 ].join('').replaceAll('/api/labs/htmx/search', apiUrl('/api/labs/htmx/search'));

interface HtmxRequestDetail {
  xhr: XMLHttpRequest;
  elt: Element;
  target: Element;
  successful: boolean;
  failed: boolean;
}

function isTrustedHtmxRequest(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.origin === (IS_TOY ? API_ORIGIN : window.location.origin)
      && parsed.pathname === (IS_TOY ? '/api/toy/labs/htmx/search' : '/api/labs/htmx/search');
  } catch { return false; }
}

/**
 * htmx：由 htmx 自己发请求、自己交换 HTML。
 * 这里没有任何 fetch + innerHTML 的伪实现 —— 事件监听只是把 htmx 已经发生的事情显示出来。
 */
export default function HtmxLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const processedRef = useRef(false);
  const startRef = useRef(0);
  const mountedRef = useRef(true);

  const [requests, setRequests] = useState(0);
  const [swaps, setSwaps] = useState(0);
  const [lastUrl, setLastUrl] = useState('—');
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // 只处理一次：React 挂载后把这段原始标记交给 htmx，之后 DOM 归 htmx 管。
  useEffect(() => {
    const root = rootRef.current;
    if (!root || processedRef.current) return;
    processedRef.current = true;
    htmx.process(root);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const onBeforeRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ xhr: XMLHttpRequest }>).detail;
      if (!detail?.xhr) return;
      startRef.current = performance.now();
    };

    const onAfterRequest = (event: Event) => {
      const detail = (event as CustomEvent<HtmxRequestDetail>).detail;
      if (!detail?.xhr) return;
      const url = detail.xhr.responseURL || '';
      if (!isTrustedHtmxRequest(url)) return;
      if (!mountedRef.current) return;
      setRequests((n) => n + 1);
      setLastUrl(url);
      setLastStatus(detail.xhr.status);
      setLastMs(Math.round(performance.now() - startRef.current));
      setErrorText(null);
    };

    const onAfterSwap = (event: Event) => {
      const detail = (event as CustomEvent<HtmxRequestDetail>).detail;
      if (!detail?.xhr) return;
      const url = detail.xhr.responseURL || '';
      if (!isTrustedHtmxRequest(url)) return;
      if (!mountedRef.current) return;
      if (IS_TOY) rootRef.current?.querySelectorAll<HTMLAnchorElement>('a[href^="/tools/"]').forEach(a => {a.href = routeHref(a.getAttribute('href')!);});
      setSwaps((n) => n + 1);
    };

    const onResponseError = (event: Event) => {
      const detail = (event as CustomEvent<HtmxRequestDetail>).detail;
      if (!detail?.xhr) return;
      const url = detail.xhr.responseURL || '';
      if (!isTrustedHtmxRequest(url)) return;
      if (!mountedRef.current) return;
      // htmx 对非 2xx 默认不交换内容，所以错误必须显式呈现。
      setRequests((n) => n + 1);
      setLastUrl(url);
      setLastStatus(detail.xhr.status);
      setLastMs(Math.round(performance.now() - startRef.current));
      setErrorText(`后端返回 HTTP ${detail.xhr.status}。htmx 对非 2xx 响应不会交换内容，#lab-htmx-results 保持上一次的成功片段。`);
    };

    const validateUrl = (event: Event) => { if (!isTrustedHtmxRequest(String((event as CustomEvent).detail?.url || ''))) event.preventDefault(); };
    document.body.addEventListener('htmx:validateUrl', validateUrl);
    document.body.addEventListener('htmx:beforeRequest', onBeforeRequest);
    document.body.addEventListener('htmx:afterRequest', onAfterRequest);
    document.body.addEventListener('htmx:afterSwap', onAfterSwap);
    document.body.addEventListener('htmx:responseError', onResponseError);

    return () => {
      mountedRef.current = false;
      document.body.removeEventListener('htmx:validateUrl', validateUrl);
      document.body.removeEventListener('htmx:beforeRequest', onBeforeRequest);
      document.body.removeEventListener('htmx:afterRequest', onAfterRequest);
      document.body.removeEventListener('htmx:afterSwap', onAfterSwap);
      document.body.removeEventListener('htmx:responseError', onResponseError);
    };
  }, []);

  /** 走 htmx 自己的 ajax API 触发一次真实的 400：q 超过后端允许的 80 字符。 */
  const triggerBadRequest = useCallback(() => {
    const target = document.getElementById('lab-htmx-results');
    if (!target) return;
    const path = `/api/labs/htmx/search?q=${'x'.repeat(90)}`;
    setLastUrl(path);
    void htmx.ajax('get', apiUrl(path), { target, swap: 'innerHTML' });
  }, []);

  const htmxVersion = htmx.version;

  return (
    <Lab
      title="htmx HTML 属性请求"
      badge={<span className="demo-live-badge">htmx {htmxVersion}</span>}
      reset={() => {
        const input = document.getElementById('lab-htmx-q') as HTMLInputElement | null;
        const results = document.getElementById('lab-htmx-results');
        if (input) {
          input.value = '';
          input.focus();
        }
        if (results) {
          results.innerHTML = '<p class="lab-htmx__hint">还没有发过请求。在上方输入内容，htmx 会自己发 GET 请求，并把后端返回的 HTML 片段换进这里。</p>';
        }
        setErrorText(null);
      }}
    >
      <LabLayout
        controls={
          <>
            <div className="lab-field">
              <span>安全配置</span>
              <ul className="lab-htmx-config">
                <li data-ok={String(htmx.config.allowEval === false)}>allowEval = {String(htmx.config.allowEval)}</li>
                <li data-ok={String(htmx.config.allowScriptTags === false)}>allowScriptTags = {String(htmx.config.allowScriptTags)}</li>
                <li data-ok={String(htmx.config.selfRequestsOnly === true)}>selfRequestsOnly = {String(htmx.config.selfRequestsOnly)}</li>
              </ul>
            </div>
            <Status>
              这块内容来自本站后端，属于可信来源。即便如此，htmx 的配置依然禁止执行表达式与插入 script 标签，
              {IS_TOY ? '请求仅允许访问目录站的只读接口。' : '请求也被限制为同源。'}
            </Status>
            <div className="lab-options">
              <button type="button" className="button button--secondary button--small" onClick={triggerBadRequest}>
                触发一次真实的 400（q 超长）
              </button>
            </div>
            <Status>
              400 由后端真实返回。htmx 对非 2xx 响应默认不做交换，页面上的结果会保持上一次的成功内容。
            </Status>
          </>
        }
      >
        <div className="lab-htmx-body">
          <Stats>
            <Stat label="htmx 请求数" value={requests} />
            <Stat label="成功交换数" value={swaps} />
            <Stat label="最近状态码" value={lastStatus ?? '—'} />
          </Stats>
          <Stats>
            <Stat label="最近请求 URL" value={<span className="lab-htmx-mono">{lastUrl}</span>} />
            <Stat label="浏览器端往返" value={lastMs === null ? '—' : `${lastMs} ms`} />
            <Stat label="Content-Type" value="text/html" />
          </Stats>
          {lastMs === null ? null : (
            <Status tone="ok">往返时间为浏览器实测值（含真实网络与 D1 查询），不是写死的数字。</Status>
          )}
          {errorText ? (
            <div className="lab-error" role="alert">
              <div>
                <strong>{errorText}</strong>
              </div>
            </div>
          ) : null}

          <div className="lab-htmx-root" ref={rootRef} dangerouslySetInnerHTML={{ __html: MARKUP }} />
        </div>
      </LabLayout>

      <Code text={MARKUP} onCopy={onCopy} label="htmx 标记" maxHeight={260} />
    </Lab>
  );
}
