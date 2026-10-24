import { assetUrl, IS_TOY } from '../../lib/runtime';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as esbuild from 'esbuild-wasm';
import type { TransformFailure, TransformOptions, TransformResult } from 'esbuild-wasm';
import type { DemoCopyHandler } from '../types';
import {
  Code,
  ErrorNote,
  Lab,
  LabLayout,
  Segmented,
  Select,
  Stat,
  Stats,
  Status,
  useDebounced,
} from '../lab-kit';

/* ------------------------------------------------------------------ */
/* One-time WASM bootstrap                                            */
/* ------------------------------------------------------------------ */

/**
 * esbuild 的 WASM 二进制**不**走 Vite 的 `?url` 产物，而是放在本站自己的 R2 上。
 *
 * - 该文件由 `assets/demos/manifest.json` 登记：
 *   key = `demos/esbuild/esbuild_e2b4b98297e0.wasm`，file = `assets/demos/esbuild/esbuild_e2b4b98297e0.wasm`，
 *   contentType = `application/wasm`，来源 `npm:esbuild-wasm@0.24.2`（MIT），
 *   文件名带内容哈希、构建时按 manifest 校验 sha256。
 * - 部署后由本站 Worker 从 R2 以 `/media/` 前缀提供，内容类型固定为 `application/wasm`
 *   （实测 `curl -I /media/demos/esbuild/esbuild_e2b4b98297e0.wasm` → 200 + `application/wasm`）。
 * - 因为与页面同源，esbuild 可以直接 `WebAssembly.instantiateStreaming` 拉取它：
 *   没有 CDN、没有跨域请求、也没有打包进主 chunk。
 */
const WASM_URL = assetUrl('/media/demos/esbuild/esbuild_e2b4b98297e0.wasm');

/**
 * `esbuild.initialize()` 成功之后不能再次调用，所以 promise 在模块作用域内记忆化，
 * 由所有挂载共享。
 *
 * CSP notes:
 * - `wasmURL` 是**同源**的 `/media/` 路径（二进制来自本站 R2），所以没有 CDN、没有跨域请求。
 * - `worker: false` —— esbuild 的 WASM 服务跑在主线程上。默认的 `worker: true` 会创建
 *   `blob:` worker，本站的 CSP 不允许，必须保持关闭。
 */
let bootstrap: Promise<string> | null = null;

function ready(): Promise<string> {
  if (!bootstrap) {
    // 用 `Promise.resolve().then(...)` 包一层：这样 `initialize()` 的同步 throw
    // 也会变成 rejection，而不是从 `ready()` 里直接抛出去。
    bootstrap = Promise.resolve()
      .then(() => esbuild.initialize({ wasmURL: assetUrl(WASM_URL), worker: false }))
      .then(() => esbuild.version)
      .catch((err: unknown) => {
        // esbuild 自己在初始化失败时会把内部的 initializePromise 清空（允许重新
        // initialize），所以这里也丢掉缓存的 promise，让下一次调用真正重新拉起
        // WASM 服务，而不是把同一个失败 promise 一直复用下去。
        bootstrap = null;
        throw err;
      });
  }
  return bootstrap;
}

/* ------------------------------------------------------------------ */
/* Types & presets                                                     */
/* ------------------------------------------------------------------ */

type Loader = 'tsx' | 'ts' | 'jsx' | 'js';

const LOADERS: readonly (readonly [Loader, string])[] = [
  ['tsx', 'tsx'],
  ['ts', 'ts'],
  ['jsx', 'jsx'],
  ['js', 'js'],
];

const TARGETS = ['es2020', 'es2017', 'es2015', 'es5'] as const;
type Target = (typeof TARGETS)[number];

/** 输入上限：WASM 在主线程上跑，超大输入会把页面卡住。 */
const MAX_SOURCE_CHARS = 20000;
const MAX_SOURCE_LINES = 2000;

const TSX_SAMPLE = `type Props = { name: string; count?: number };

export function Badge({ name, count = 0 }: Props) {
  const labels: string[] = [name].map((s: string) => s.toUpperCase());
  return (
    <span className="badge" data-count={count} title={name}>
      {labels.join(' / ')} · {count}
    </span>
  );
}

const fallback = <Badge name="esbuild" count={3} />;
console.log(Badge({ name: 'demo' }), fallback);
`;

const TS_SAMPLE = `interface Point { x: number; y: number }
type Shape = { name: string; points: Point[]; closed?: boolean };

export function perimeter(shape: Shape): number {
  const pts = shape.points;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return shape.closed && pts.length > 2 ? total + Math.hypot(pts[0].x - pts.at(-1)!.x, pts[0].y - pts.at(-1)!.y) : total;
}

export const scale = (s: Shape, k: number): Shape => ({
  ...s,
  points: s.points.map((p) => ({ x: p.x * k, y: p.y * k })),
});
`;

/** loader 为 `js` 时使用：**纯 JavaScript，不含任何 JSX**，否则 `js` 模式一上来就是语法错误。 */
const JS_SAMPLE = `// 纯 JavaScript 源码：不含 JSX，对应 loader: 'js'
export function formatUser(user) {
  const parts = [user.name, user.email].filter(Boolean);
  return parts.join(' · ');
}

export function summarize(users) {
  return users
    .filter((user) => user.active)
    .map(formatUser)
    .join('\\n');
}

console.log(summarize([{ name: '张三', email: 'zhang@example.com', active: true }]));
`;

const BROKEN_SAMPLE = `export function Broken({ value }) {
  const items: number[] = [1, 2, 3]
  return <ul>{items.map((n) => <li>{n}</li>)}
}
`;

const JSX_SAMPLE = `export function List({ items, tone }) {
  return (
    <ul className="list" data-tone={tone}>
      {items.map((item, i) => (
        <li key={i} aria-label={item.id}>{item.label}</li>
      ))}
    </ul>
  );
}

const rows = [{ id: 'a', label: '第一项' }, { id: 'b', label: '第二项' }];
console.log(<List items={rows} tone="calm" />);
`;

/** 每个 loader 对应的示例源码；`js` 走纯 JS，`jsx` 走含 JSX 的源码。 */
const SAMPLES: Record<Loader, string> = {
  tsx: TSX_SAMPLE,
  ts: TS_SAMPLE,
  js: JS_SAMPLE,
  jsx: JSX_SAMPLE,
};

/* ------------------------------------------------------------------ */
/* Real transform                                                      */
/* ------------------------------------------------------------------ */

interface Success {
  ok: true;
  code: string;
  bytesIn: number;
  bytesOut: number;
  durationMs: number;
  warnings: string[];
}
interface Failure {
  ok: false;
  message: string;
  errors: string[];
  durationMs: number;
}

const encoder = new TextEncoder();

async function transform(source: string, options: TransformOptions): Promise<Success | Failure> {
  const started = performance.now();
  try {
    const result: TransformResult = await esbuild.transform(source, options);
    const durationMs = performance.now() - started;
    return {
      ok: true,
      code: result.code,
      bytesIn: encoder.encode(source).length,
      bytesOut: encoder.encode(result.code).length,
      durationMs,
      warnings: result.warnings.map(
        (w) => `${w.location ? `${w.location.file}:${w.location.line}:${w.location.column + 1} ` : ''}${w.text}`,
      ),
    };
  } catch (err) {
    const durationMs = performance.now() - started;
    const failure = err as Partial<TransformFailure>;
    const errors = Array.isArray(failure.errors) ? failure.errors : [];
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      errors: errors.map((e) => {
        const loc = e.location;
        return loc ? `${loc.file}:${loc.line}:${loc.column + 1} ERROR ${e.text}\n  ${loc.lineText}` : e.text;
      }),
      durationMs,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

export default function EsbuildLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [loader, setLoader] = useState<Loader>('tsx');
  const [source, setSource] = useState(TSX_SAMPLE);
  const [target, setTarget] = useState<Target>('es2020');
  const [minify, setMinify] = useState(false);
  const [jsxAutomatic, setJsxAutomatic] = useState(true);

  /**
   * 初始化尝试次数。`ErrorNote` 的“重试”会把它 +1，初始化 effect 依赖它，
   * 于是第二次尝试会真正重新调用 `ready()`（失败时缓存的 promise 已被清空）。
   */
  const [bootNonce, setBootNonce] = useState(0);
  const [boot, setBoot] = useState<{ state: 'loading' } | { state: 'ready'; version: string } | { state: 'error'; message: string }>(
    { state: 'loading' },
  );
  const [run, setRun] = useState<Success | Failure | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void ready()
      .then((version) => {
        if (!cancelled) setBoot({ state: 'ready', version });
      })
      .catch((err: unknown) => {
        if (!cancelled) setBoot({ state: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [bootNonce]);

  const sourceLines = useMemo(() => source.split('\n').length, [source]);
  const overLimit = source.length > MAX_SOURCE_CHARS || sourceLines > MAX_SOURCE_LINES;
  const limitReason = useMemo(() => {
    if (source.length > MAX_SOURCE_CHARS) {
      return `源码长度 ${source.length.toLocaleString('zh-CN')} 字符，已超过 ${MAX_SOURCE_CHARS.toLocaleString('zh-CN')} 字符上限`;
    }
    if (sourceLines > MAX_SOURCE_LINES) {
      return `源码行数 ${sourceLines.toLocaleString('zh-CN')} 行，已超过 ${MAX_SOURCE_LINES.toLocaleString('zh-CN')} 行上限`;
    }
    return '';
  }, [source.length, sourceLines]);

  const debounced = useDebounced(source, 260);

  useEffect(() => {
    if (boot.state !== 'ready') return;
    // 超过上限就完全不编译：WASM 在主线程上，超大输入会卡住页面。
    // 也不截断用户输入 —— 上层会把真实原因显示出来。
    if (debounced.length > MAX_SOURCE_CHARS || debounced.split('\n').length > MAX_SOURCE_LINES) {
      setRun(null);
      return;
    }
    const id = ++runId.current;
    const options: TransformOptions = {
      loader,
      jsx: jsxAutomatic ? 'automatic' : 'transform',
      jsxFactory: jsxAutomatic ? undefined : 'h',
      jsxFragment: jsxAutomatic ? undefined : 'Fragment',
      target,
      minify,
      sourcefile: `demo.${loader}`,
    };
    let cancelled = false;
    void transform(debounced, options).then((result) => {
      if (cancelled || runId.current !== id) return;
      setRun(result);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, loader, target, minify, jsxAutomatic, boot.state]);

  const snippet = useMemo(
    () =>
      [
        `import * as esbuild from 'esbuild-wasm';`,
        ``,
        IS_TOY ? '// WASM 二进制随 Toy 包分发，来源和 SHA-256 见 assets/demos/manifest.json' : `// WASM 二进制来自 assets/demos/manifest.json，由本站 R2 在 /media/ 下提供（application/wasm）`,
        `const wasmURL = '${WASM_URL}';`,
        ``,
        `// worker: false —— 不创建 blob: worker，WASM 服务跑在主线程`,
        `await esbuild.initialize({ wasmURL, worker: false });`,
        ``,
        `const t0 = performance.now();`,
        `const result = await esbuild.transform(source, {`,
        `  loader: '${loader}',`,
        `  jsx: '${jsxAutomatic ? 'automatic' : 'transform'}',`,
        `  target: '${target}',`,
        `  minify: ${minify},`,
        `});`,
        `console.log(result.code, performance.now() - t0);`,
        ``,
        `// transform 失败时抛出的对象带有 .errors[].location`,
      ].join('\n'),
    [loader, target, minify, jsxAutomatic],
  );

  const loadSample = useCallback((next: Loader) => {
    setLoader(next);
    setSource(SAMPLES[next]);
  }, []);

  /** 真正的初始化重试：递增尝试序号，让初始化 effect 重新跑一次 `ready()`。 */
  const retryBoot = useCallback(() => {
    setBoot({ state: 'loading' });
    setBootNonce((n) => n + 1);
  }, []);

  const reset = useCallback(() => {
    setLoader('tsx');
    setSource(TSX_SAMPLE);
    setTarget('es2020');
    setMinify(false);
    setJsxAutomatic(true);
    // 顺带重新走一次初始化：失败时这是唯一的恢复路径，成功时 ready() 会直接返回
    // 已经解析的缓存 promise，不会重复实例化 WASM。
    setBoot({ state: 'loading' });
    setBootNonce((n) => n + 1);
  }, []);

  const success = run && run.ok ? run : null;
  const failure = run && !run.ok ? run : null;

  return (
    <Lab
      title="esbuild-wasm 编译 TS / TSX"
      badge={
        <span className="demo-live-badge">
          esbuild {boot.state === 'ready' ? boot.version : '0.24.2'}
        </span>
      }
      reset={reset}
    >
      <LabLayout
        controls={
          <>
            <Segmented<Loader> label="loader" value={loader} options={LOADERS} onChange={loadSample} />
            <Select<Target> label="target" value={target} options={[...TARGETS]} onChange={setTarget} />
            <div className="lab-options">
              <label>
                <input type="checkbox" checked={minify} onChange={(e) => setMinify(e.target.checked)} />
                minify
              </label>
              <label>
                <input type="checkbox" checked={jsxAutomatic} onChange={(e) => setJsxAutomatic(e.target.checked)} />
                jsx: automatic（关闭则用 h / Fragment 传统工厂）
              </label>
            </div>
            <div className="lab-options">
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => {
                  setLoader('tsx');
                  setSource(TSX_SAMPLE);
                }}
              >
                TSX 示例
              </button>
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => {
                  setLoader('ts');
                  setSource(TS_SAMPLE);
                }}
              >
                TS 示例
              </button>
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => {
                  setLoader('js');
                  setSource(JS_SAMPLE);
                }}
              >
                JS 示例
              </button>
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => {
                  setLoader('tsx');
                  setSource(BROKEN_SAMPLE);
                }}
              >
                语法错误示例
              </button>
              <button type="button" className="button button--secondary button--small" onClick={() => setSource('')}>
                清空
              </button>
            </div>
            <Status>
              WASM 二进制登记在 <code>assets/demos/manifest.json</code>，{IS_TOY ? '随 Toy 包分发，以' : <>由本站 R2 在 <code>/media/</code> 下以</>}
              <code> application/wasm </code>提供；initialize 传入这个同源 URL 并显式关闭 worker。
            </Status>
          </>
        }
      >
        {boot.state === 'error' ? (
          <ErrorNote onRetry={retryBoot}>
            esbuild 初始化失败：{boot.message}（点击“重试”会重新拉取 WASM 并再次 initialize）
          </ErrorNote>
        ) : (
          <div>
            <label className="lab-field">
              <span>源码（可编辑）</span>
              <textarea
                className="lab-editor"
              wrap={IS_TOY ? 'off' : undefined}
                rows={15}
                spellCheck={false}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
            <div className="lab-esbuild-limit">
              <span className={overLimit ? 'lab-esbuild-counter lab-esbuild-counter--over' : 'lab-esbuild-counter'}>
                {source.length.toLocaleString('zh-CN')} 字符 · {sourceLines.toLocaleString('zh-CN')} 行
                {overLimit ? ' · 超出上限' : ''}
              </span>
              <span>上限 {MAX_SOURCE_CHARS.toLocaleString('zh-CN')} 字符 / {MAX_SOURCE_LINES.toLocaleString('zh-CN')} 行</span>
            </div>
            {overLimit ? (
              <ErrorNote>
                {limitReason}。为避免在主线程的 WASM 里卡死，本次编译已跳过；你的输入没有被截断，请自行删减后再编译。
              </ErrorNote>
            ) : null}
            <small className="lab-field__rule">
              {boot.state === 'loading' ? '正在加载并实例化 esbuild 的 WASM 模块…' : '停顿 260ms 后自动重新编译。'}
            </small>
          </div>
        )}
      </LabLayout>

      <div style={{ marginTop: 22 }}>
        {failure ? (
          <ErrorNote>
            esbuild.transform 失败（{failure.durationMs.toFixed(2)} ms）：
            <pre className="lab-esbuild-errors">{failure.errors.join('\n') || failure.message}</pre>
          </ErrorNote>
        ) : null}

        <Stats>
          <Stat label="本次编译耗时（单次测量）" value={run ? `${run.durationMs.toFixed(2)} ms` : '—'} />
          <Stat label="输入字节" value={success ? `${success.bytesIn} B` : '—'} />
          <Stat
            label="输出字节"
            value={success ? `${success.bytesOut} B` : '—'}
          />
        </Stats>
        <small className="lab-field__rule">
          耗时为 performance.now() 包住 await transform() 的实测值，只代表这一次调用（单次测量，不代表稳定基准）；编译结果只展示，页面从不执行它。
        </small>

        {success && success.warnings.length > 0 ? (
          <div className="lab-esbuild-warnings">
            {success.warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="lab-editor-grid lab-editor-grid--tight">
        <Code text={source} onCopy={onCopy} label="TS / TSX 源码" maxHeight={420} />
        {success ? (
          <Code text={success.code} onCopy={onCopy} label="esbuild 输出" maxHeight={420} />
        ) : (
          <div className="lab-code">
            <div>
              <span>esbuild 输出</span>
            </div>
            <pre>
              <code>{failure ? '（编译失败，见上方真实报错）' : overLimit ? '（源码超过上限，未编译）' : '等待编译…'}</code>
            </pre>
          </div>
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <Code text={snippet} onCopy={onCopy} label="esbuild 调用" maxHeight={300} />
      </div>
    </Lab>
  );
}
