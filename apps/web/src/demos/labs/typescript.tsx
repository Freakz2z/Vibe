import { IS_TOY } from '../../lib/runtime';
import { useMemo, useState } from 'react';
import * as tsModule from 'typescript';
import type { CompilerHost, CompilerOptions, Diagnostic } from 'typescript';
import type { DemoCopyHandler } from '../types';
import {
  Code,
  DataTable,
  ErrorNote,
  Lab,
  LabLayout,
  Segmented,
  Stat,
  Stats,
  Status,
  useDebounced,
} from '../lab-kit';

/* ------------------------------------------------------------------ */
/* Compiler handle                                                     */
/* ------------------------------------------------------------------ */

type TsApi = typeof tsModule;

/**
 * `typescript/lib/typescript.js` is CJS and assigns itself through a
 * `module.exports` setter, so bundlers hand it to ESM either as the namespace
 * itself or nested under `default`. Normalise once. Nothing is copied or
 * stubbed — it is the real compiler either way.
 *
 * Named `tsc` rather than `ts` so the `ts` *namespace* (which carries the types
 * below) stays reachable in type positions.
 */
const tsc: TsApi = ((tsModule as unknown as { default?: TsApi }).default ?? tsModule) as TsApi;

/* ------------------------------------------------------------------ */
/* Virtual file system                                                 */
/* ------------------------------------------------------------------ */

const GLOBALS_FILE = '/globals.d.ts';
const MAIN_FILE = '/main.ts';

/**
 * A deliberately tiny ambient lib. The browser has no way to hand lib.d.ts to
 * the checker, so we run with `noLib: true` and declare just enough built-ins
 * for the sample to type-check against. Everything else the checker reports is
 * a genuine diagnostic from `program.getSemanticDiagnostics()`.
 */
const GLOBALS_SOURCE = `// 由本演示提供的最小内建声明（浏览器里拿不到 lib.d.ts）
declare interface Object {}
declare interface Function {}
declare interface Boolean { valueOf(): boolean; }
declare interface Number { toFixed(digits: number): string; valueOf(): number; }
declare interface String { length: number; toUpperCase(): string; toLowerCase(): string; trim(): string; }
declare interface Date { getTime(): number; toISOString(): string; }
declare interface RegExp { test(input: string): boolean; }
declare interface Error { message: string; }
declare interface Array<T> {
  length: number;
  map<U>(callback: (value: T, index: number, array: T[]) => U): U[];
  filter(predicate: (value: T, index: number, array: T[]) => boolean): T[];
  push(...items: T[]): number;
}
declare var console: { log(...args: unknown[]): void; error(...args: unknown[]): void };
declare var Date: { new (): Date; now(): number };
declare var JSON: { stringify(value: unknown): string; parse(text: string): unknown };
declare var Math: { floor(n: number): number; max(a: number, b: number): number; min(a: number, b: number): number; };
declare function parseInt(text: string, radix?: number): number;
declare function String(value?: unknown): string;
declare function Number(value?: unknown): number;
declare function Boolean(value?: unknown): boolean;
declare function Array<T>(...items: T[]): T[];
declare var Error: { new (message: string): Error };
`;

const SAMPLE_ERRORS = `type Order = { id: string; total: number; paidAt?: Date };

const orders: Order[] = [
  { id: 'A-1', total: 128.5 },
  { id: 'A-2', total: 88, paidAt: new Date() },
];

const draft: Order = { id: 'A-1', total: 128.5 };
const currency: string = draft.currency;      // ① 属性不存在

const ids = orders.map((order: number) => order.id); // ② 回调参数类型不匹配

function describe(value: string | number) {
  return value.toUpperCase();                 // ③ 联合类型未收窄
}

orders.map();                                 // ④ 实参个数不足

const paid = orders.filter((o) => Boolean(o.paidAt)); // 这一行是正确的
console.log(currency, ids, describe('ok'), paid.length);
`;

const SAMPLE_CLEAN = `type Order = { id: string; total: number; paidAt?: Date };

const orders: Order[] = [
  { id: 'A-1', total: 128.5 },
  { id: 'A-2', total: 88, paidAt: new Date() },
];

const draft: Order = { id: 'A-1', total: 128.5 };
const currency: string = 'CNY';

const ids = orders.map((order: Order) => order.id);

function describe(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  return String(value);
}

const late = orders.filter((o) => Boolean(o.paidAt));
console.log(currency, ids, describe('ok'), draft.total, late.length);
`;

const SAMPLE_SYNTAX = `const total: = 42;
function broken( {
  return 1
`;

/* ------------------------------------------------------------------ */
/* Real in-memory type check                                           */
/* ------------------------------------------------------------------ */

interface Diag {
  code: number;
  category: string;
  kind: 'syntactic' | 'semantic';
  message: string;
  line: number;
  column: number;
  file: string;
}

interface CheckResult {
  diagnostics: Diag[];
  syntacticCount: number;
  semanticCount: number;
  durationMs: number;
}

const CATEGORY_LABEL: Record<number, string> = {
  [tsc.DiagnosticCategory.Error]: '错误',
  [tsc.DiagnosticCategory.Warning]: '警告',
  [tsc.DiagnosticCategory.Suggestion]: '建议',
  [tsc.DiagnosticCategory.Message]: '提示',
};

/**
 * Builds a real `ts.Program` over two in-memory files with a custom
 * `CompilerHost`, then reads the checker's own diagnostics. No regex, no
 * hand-written error list, and nothing from the source string is executed.
 */
function check(source: string): CheckResult {
  const files = new Map<string, string>([
    [GLOBALS_FILE, GLOBALS_SOURCE],
    [MAIN_FILE, source],
  ]);

  const options: CompilerOptions = {
    target: tsc.ScriptTarget.ESNext,
    module: tsc.ModuleKind.ESNext,
    jsx: tsc.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    noLib: true,
    skipLibCheck: true,
    types: [],
  };

  // Written by hand rather than via `ts.createCompilerHost()`: that helper reads
  // the module-level `ts.sys`, which is `undefined` in a browser (no `require`),
  // so it throws before it ever returns a host. This host talks to nothing but
  // the two strings in `files` — no disk, no fetch, no worker.
  const host: CompilerHost = {
    getSourceFile(fileName, languageVersion) {
      const text = files.get(fileName);
      return text === undefined ? undefined : tsc.createSourceFile(fileName, text, languageVersion, true);
    },
    getDefaultLibFileName: () => GLOBALS_FILE,
    writeFile: () => undefined,
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (fileName) => files.has(fileName),
    readFile: (fileName) => files.get(fileName),
    directoryExists: (dir) => dir === '/',
    getDirectories: () => [],
    realpath: (fileName) => fileName,
    getDefaultLibLocation: () => '/',
  };

  const started = performance.now();
  const program = tsc.createProgram([GLOBALS_FILE, MAIN_FILE], options, host);

  const syntactic = program.getSyntacticDiagnostics();
  const semantic = program.getSemanticDiagnostics();
  const sourceFile = program.getSourceFile(MAIN_FILE);
  const durationMs = performance.now() - started;

  const toDiag = (list: readonly Diagnostic[], kind: Diag['kind']): Diag[] =>
    list.map((d) => {
      const pos = sourceFile && typeof d.start === 'number'
        ? sourceFile.getLineAndCharacterOfPosition(d.start)
        : { line: 0, character: 0 };
      return {
        code: d.code,
        category: CATEGORY_LABEL[d.category] ?? String(d.category),
        kind,
        message: tsc.flattenDiagnosticMessageText(d.messageText, ' '),
        line: pos.line + 1,
        column: pos.character + 1,
        file: sourceFile?.fileName ?? MAIN_FILE,
      };
    });

  const diagnostics = [...toDiag(syntactic, 'syntactic'), ...toDiag(semantic, 'semantic')].sort(
    (x, y) => x.line - y.line || x.column - y.column,
  );

  return {
    diagnostics,
    syntacticCount: syntactic.length,
    semanticCount: semantic.length,
    durationMs,
  };
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

type Preset = 'errors' | 'clean' | 'syntax';

const PRESETS: readonly (readonly [Preset, string])[] = [
  ['errors', '语义错误示例'],
  ['clean', '零错误示例'],
  ['syntax', '语法错误示例'],
];

const PRESET_SOURCE: Record<Preset, string> = {
  errors: SAMPLE_ERRORS,
  clean: SAMPLE_CLEAN,
  syntax: SAMPLE_SYNTAX,
};

export default function TypescriptLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [source, setSource] = useState(SAMPLE_ERRORS);
  const [preset, setPreset] = useState<Preset>('errors');
  const [showSyntactic, setShowSyntactic] = useState(true);
  const debounced = useDebounced(source, 420);

  const result = useMemo<{ ok: true; data: CheckResult } | { ok: false; error: string }>(() => {
    try {
      return { ok: true, data: check(debounced) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [debounced]);

  const data = result.ok ? result.data : null;
  const visible = (data?.diagnostics ?? []).filter((d) => showSyntactic || d.kind === 'semantic');
  const errors = visible.filter((d) => d.category === '错误');

  const applyPreset = (next: Preset) => {
    setPreset(next);
    setSource(PRESET_SOURCE[next]);
  };

  const snippet = useMemo(
    () =>
      [
        `import * as ts from 'typescript';`,
        ``,
        `const files = new Map([['/globals.d.ts', GLOBALS], ['/main.ts', source]]);`,
        ``,
        `// ts.sys 在浏览器里是 undefined，所以 CompilerHost 只能自己写`,
        `const host: ts.CompilerHost = {`,
        `  getSourceFile: (f, v) =>`,
        `    files.has(f) ? tsc.createSourceFile(f, files.get(f)!, v, true) : undefined,`,
        `  getDefaultLibFileName: () => '/globals.d.ts',`,
        `  fileExists: (f) => files.has(f),`,
        `  readFile: (f) => files.get(f),`,
        `  writeFile: () => {},   // 不落盘`,
        `  // …其余成员见源码`,
        `};`,
        ``,
        `const program = tsc.createProgram([...files.keys()], options, host);`,
        `const syntactic = program.getSyntacticDiagnostics();`,
        `const semantic  = program.getSemanticDiagnostics();`,
        ``,
        `for (const d of [...syntactic, ...semantic]) {`,
        `  const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start);`,
        `  console.log(d.code, line + 1 + ':' + (character + 1),`,
        `    tsc.flattenDiagnosticMessageText(d.messageText, ' '));`,
        `}`,
      ].join('\n'),
    [],
  );

  const reset = () => applyPreset('errors');

  return (
    <Lab title="TypeScript 真实类型检查" badge={<span className="demo-live-badge">tsc {tsc.version}</span>} reset={reset}>
      <LabLayout
        controls={
          <>
            <Segmented<Preset> label="示例" value={preset} options={PRESETS} onChange={applyPreset} />
            <div className="lab-options">
              <label>
                <input type="checkbox" checked={showSyntactic} onChange={(e) => setShowSyntactic(e.target.checked)} />
                同时显示语法诊断（getSyntacticDiagnostics）
              </label>
            </div>
            <div className="lab-options">
              <button type="button" className="button button--secondary button--small" onClick={() => setSource('')}>
                清空编辑器
              </button>
            </div>
            <Status>
              编译器以 noLib + 自定义 CompilerHost 运行在内存里，不读取也不写入任何文件；源码只被解析，从不被执行。
            </Status>
          </>
        }
      >
        <div>
          <label className="lab-field">
            <span>/main.ts（可编辑）</span>
            <textarea
              className="lab-editor"
              wrap={IS_TOY ? 'off' : undefined}
              rows={16}
              spellCheck={false}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
          <small className="lab-field__rule">
            另一份虚拟文件 {GLOBALS_FILE} 提供最小内建声明；停顿 420ms 后重新跑一次完整检查。
          </small>
        </div>
      </LabLayout>

      <div style={{ marginTop: 22 }}>
        {!result.ok ? (
          <ErrorNote onRetry={reset}>{result.error}</ErrorNote>
        ) : (
          <>
            <Stats>
              <Stat label="错误" value={errors.length} />
              <Stat label="语法诊断" value={result.data.syntacticCount} />
              <Stat label="语义诊断" value={result.data.semanticCount} />
            </Stats>
            <small className="lab-field__rule">
              本次类型检查耗时 {result.data.durationMs.toFixed(1)} ms（performance.now() 单次测量，含 createProgram，不含等待输入的防抖时间）。
            </small>

            {visible.length === 0 ? (
              <Status tone="ok">
                没有诊断信息 —— 真实检查器在 strict + noLib 下认为这段代码是干净的。
              </Status>
            ) : (
              <DataTable
                head={['位置', 'TS 错误码', '种类', '检查器给出的原始信息']}
                caption="以下每一条都直接来自 tsc.flattenDiagnosticMessageText(d.messageText, ' ')"
                rows={visible.map((d, i) => [
                  <code key={`p${i}`}>{`${d.line}:${d.column}`}</code>,
                  <code key={`c${i}`}>TS{d.code}</code>,
                  d.kind === 'syntactic' ? '语法（syntactic）' : '语义（semantic）',
                  <span key={`m${i}`} className={d.category === '错误' ? 'lab-tsc-msg lab-tsc-msg--error' : 'lab-tsc-msg'}>
                    {d.message}
                  </span>,
                ])}
              />
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <Code text={source} onCopy={onCopy} label="/main.ts" maxHeight={340} />
      </div>
      <div style={{ marginTop: 22 }}>
        <Code text={snippet} onCopy={onCopy} label="编译器调用" maxHeight={340} />
      </div>
    </Lab>
  );
}
