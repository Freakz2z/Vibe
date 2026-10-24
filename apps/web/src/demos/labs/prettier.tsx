import { IS_TOY } from '../../lib/runtime';
import { useEffect, useMemo, useRef, useState } from 'react';
import { format as prettierFormat } from 'prettier/standalone';
import * as babelPlugin from 'prettier/plugins/babel';
import * as estreePlugin from 'prettier/plugins/estree';
import * as typescriptPlugin from 'prettier/plugins/typescript';
import type { Options as PrettierOptions, Plugin } from 'prettier';
import type { DemoCopyHandler } from '../types';
import {
  Code,
  ErrorNote,
  Lab,
  LabLayout,
  Range,
  Segmented,
  Select,
  Stat,
  Stats,
  Status,
  useDebounced,
} from '../lab-kit';

/* ------------------------------------------------------------------ */
/* Real plugin set (bundled, no CDN)                                   */
/* ------------------------------------------------------------------ */

// prettier/plugins/estree ships `export {}` in its .d.ts, so it needs a cast;
// at runtime it is the module that carries the `printers` Prettier needs.
const PLUGINS = [
  babelPlugin as unknown as Plugin,
  estreePlugin as unknown as Plugin,
  typescriptPlugin as unknown as Plugin,
];

type Parser = 'typescript' | 'babel';

const PARSERS: readonly (readonly [Parser, string])[] = [
  ['typescript', 'typescript'],
  ['babel', 'babel（JS/JSX）'],
];

type TrailingComma = 'all' | 'es5' | 'none';
type ArrowParens = 'always' | 'avoid';

const TRAILING: readonly (readonly [TrailingComma, string])[] = [
  ['all', 'all'],
  ['es5', 'es5'],
  ['none', 'none'],
];

const ARROWS: readonly (readonly [ArrowParens, string])[] = [
  ['always', 'always'],
  ['avoid', 'avoid'],
];

/* ------------------------------------------------------------------ */
/* Sample sources                                                      */
/* ------------------------------------------------------------------ */

const TS_SAMPLE = `type Order={id:string,total:number,paidAt?:Date}
const   orders:Order[]=[{id:'A-1',total:128.5},{id:'A-2',total:88,paidAt:new Date()}]
function total(o:Order){return o.total}
const label=orders.map(function(o){return o.id+':'+total(o)}).join(', ')
const config={alpha:1,beta:2,gamma:3,delta:4,epsilon:5,zeta:6,eta:7,theta:8,iota:9,kappa:10,lambda:11}
class Cart{constructor(private readonly list:Order[]){this.list=list}sum(){return this.list.reduce((a,b)=>a+b.total,0)}}
export {orders,label,config,Cart}
`;

const JS_SAMPLE = `const   obj={a:1,b:'two',c:[3,4,5]}   ;
function f(a,b){return a+b}
const arrow=(x)=>x*2
function Widget({title,items}){return <ul className="widget" data-title={title}>{items.map((it,i)=><li key={i}>{it}</li>)}</ul>}
const wide={ alpha:1,beta:2,gamma:3,delta:4,epsilon:5,zeta:6,eta:7,theta:8,iota:9,kappa:10,lambda:11 };
export {obj,f,arrow,Widget,wide};
`;

const BROKEN_SAMPLE = `const total = = 42;
function broken( {
  return 1
`;

/* ------------------------------------------------------------------ */
/* Real formatting                                                     */
/* ------------------------------------------------------------------ */

interface Formatting {
  output: string;
  durationMs: number;
}

interface Run {
  ok: true;
  data: Formatting;
}
interface Failed {
  ok: false;
  message: string;
  detail: string;
}

function optionsFor(
  parser: Parser,
  semi: boolean,
  singleQuote: boolean,
  tabWidth: number,
  printWidth: number,
  trailingComma: TrailingComma,
  arrowParens: ArrowParens,
): PrettierOptions {
  return {
    parser,
    semi,
    singleQuote,
    tabWidth,
    printWidth,
    trailingComma,
    arrowParens,
    endOfLine: 'lf',
    plugins: PLUGINS,
  };
}

async function runFormat(
  source: string,
  options: PrettierOptions,
  alive: () => boolean,
): Promise<Run | Failed | null> {
  const started = performance.now();
  try {
    const output = await prettierFormat(source, options);
    const durationMs = performance.now() - started;
    if (!alive()) return null;
    return { ok: true, data: { output, durationMs } };
  } catch (err) {
    if (!alive()) return null;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message, detail: message };
  }
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

export default function PrettierLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [parser, setParser] = useState<Parser>('typescript');
  const [source, setSource] = useState(TS_SAMPLE);
  const [semi, setSemi] = useState(true);
  const [singleQuote, setSingleQuote] = useState(false);
  const [tabWidth, setTabWidth] = useState(2);
  const [printWidth, setPrintWidth] = useState(80);
  const [trailingComma, setTrailingComma] = useState<TrailingComma>('all');
  const [arrowParens, setArrowParens] = useState<ArrowParens>('always');
  const [pending, setPending] = useState<Run | Failed | null>(null);

  const debouncedSource = useDebounced(source, 260);
  const runId = useRef(0);

  useEffect(() => {
    const id = ++runId.current;
    const alive = () => runId.current === id;
    let cancelled = false;
    const options = optionsFor(parser, semi, singleQuote, tabWidth, printWidth, trailingComma, arrowParens);
    void runFormat(debouncedSource, options, alive).then((result) => {
      if (cancelled || !result) return;
      setPending(result);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedSource, parser, semi, singleQuote, tabWidth, printWidth, trailingComma, arrowParens]);

  const formatted: Formatting | null = pending && pending.ok ? pending.data : null;
  const failure: Failed | null = pending && !pending.ok ? pending : null;

  const deltas = useMemo(() => {
    if (!formatted) return null;
    return {
      chars: source.length - formatted.output.length,
      bytes:
        new TextEncoder().encode(source).length - new TextEncoder().encode(formatted.output).length,
      lines: source.split('\n').length - formatted.output.split('\n').length,
    };
  }, [source, formatted]);

  const reset = () => {
    setParser('typescript');
    setSource(TS_SAMPLE);
    setSemi(true);
    setSingleQuote(false);
    setTabWidth(2);
    setPrintWidth(80);
    setTrailingComma('all');
    setArrowParens('always');
  };

  return (
    <Lab
      title="Prettier 独立版格式化"
      badge={<span className="demo-live-badge">prettier 3.4.2 standalone</span>}
      reset={reset}
    >
      <LabLayout
        controls={
          <>
            <Segmented<Parser> label="解析器" value={parser} options={PARSERS} onChange={setParser} />
            <Select<TrailingComma> label="trailingComma" value={trailingComma} options={TRAILING} onChange={setTrailingComma} />
            <Select<ArrowParens> label="arrowParens" value={arrowParens} options={ARROWS} onChange={setArrowParens} />
            <Range label="tabWidth" value={tabWidth} min={0} max={8} step={1} unit=" 空格" onChange={setTabWidth} />
            <Range label="printWidth" value={printWidth} min={40} max={160} step={5} unit=" 列" onChange={setPrintWidth} />
            <div className="lab-options">
              <label>
                <input type="checkbox" checked={semi} onChange={(e) => setSemi(e.target.checked)} />
                semi
              </label>
              <label>
                <input type="checkbox" checked={singleQuote} onChange={(e) => setSingleQuote(e.target.checked)} />
                singleQuote
              </label>
            </div>
            <div className="lab-options">
              <button type="button" className="button button--secondary button--small" onClick={() => setSource(parser === 'typescript' ? TS_SAMPLE : JS_SAMPLE)}>
                载入整齐之前的示例
              </button>
              <button type="button" className="button button--secondary button--small" onClick={() => setSource(BROKEN_SAMPLE)}>
                载入语法错误
              </button>
              <button type="button" className="button button--secondary button--small" onClick={() => setSource('')}>
                清空
              </button>
            </div>
            <Status>使用 prettier/standalone + babel + estree + typescript 三个真实插件，全部来自本地包。</Status>
          </>
        }
      >
        <div>
          <label className="lab-field">
            <span>源码（可编辑）</span>
            <textarea
              className="lab-editor"
              wrap={IS_TOY ? 'off' : undefined}
              rows={14}
              spellCheck={false}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
          <small className="lab-field__rule">
            共 {source.length} 字符 / {source.split('\n').length} 行；停顿 260ms 后自动重新格式化。
          </small>
        </div>
      </LabLayout>

      <div style={{ marginTop: 22 }}>
        {failure ? (
          <ErrorNote>
            Prettier 抛出真实异常：{failure.detail.split('\n').slice(0, 4).join(' ')}
          </ErrorNote>
        ) : null}

        <Stats>
          <Stat label="格式化耗时（单次测量）" value={formatted ? `${formatted.durationMs.toFixed(2)} ms` : '—'} />
          <Stat label="字符数变化" value={deltas ? `${deltas.chars >= 0 ? '+' : ''}${deltas.chars}` : '—'} />
          <Stat label="UTF-8 字节数变化" value={deltas ? `${deltas.bytes >= 0 ? '+' : ''}${deltas.bytes}` : '—'} />
        </Stats>
        <small className="lab-field__rule">
          耗时由 performance.now() 在 format() 调用前后实测，只代表这一次，不代表基准跑分。输出结果只做展示，页面从不执行它。
        </small>
      </div>

      <div className="lab-editor-grid lab-editor-grid--tight">
        <Code text={source} onCopy={onCopy} label="输入源码" maxHeight={420} />
        {formatted ? (
          <Code text={formatted.output} onCopy={onCopy} output label="Prettier 输出" maxHeight={420} />
        ) : (
          <div className="lab-code">
            <div>
              <span>Prettier 输出</span>
            </div>
            <pre>
              <code>{failure ? '（格式化失败，见上方真实错误）' : '正在格式化…'}</code>
            </pre>
          </div>
        )}
      </div>
    </Lab>
  );
}
