import { IS_TOY } from '../../lib/runtime';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  codeFolding,
  foldCode,
  foldEffect,
  foldGutter,
  foldKeymap,
  foldState,
  foldable,
  syntaxTree,
  unfoldCode,
} from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import {
  SearchQuery,
  findNext,
  findPrevious,
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
} from '@codemirror/search';
import { javascript, localCompletionSource } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Segmented, Stage, Stats, Stat, Status } from '../lab-kit';

type Lang = 'javascript' | 'markdown';

const SAMPLE_JS = `// 折叠箭头出现在 gutter 上；点它或按 Alt+Z 折叠 / 展开
import { createHighlighterCore } from 'shiki/core';

export function render(code, lang, theme) {
  const highlighter = createHighlighterCore({
    themes: [theme],
    langs: [lang],
  });
  try {
    return highlighter.codeToHtml(code, { lang, theme });
  } finally {
    highlighter.dispose();
  }
}

class Cache {
  #entries = new Map();

  get(key) {
    if (!this.#entries.has(key)) {
      this.#entries.set(key, compute(key));
    }
    return this.#entries.get(key);
  }
}
`;

const SAMPLE_MD = `# CodeMirror 6

- [x] 折叠 **真实** 的代码
- [ ] 搜索面板
- [ ] 自动补全

> 行内 \`code\` 与 [链接](https://codemirror.net)

\`\`\`js
const total = items.reduce((a, b) => a + b, 0);
\`\`\`
`;

const SOURCES: Record<Lang, string> = { javascript: SAMPLE_JS, markdown: SAMPLE_MD };

function languageExtension(lang: Lang): Extension {
  return lang === 'javascript' ? javascript({ jsx: false }) : markdown();
}

interface Snapshot {
  lines: number;
  chars: number;
  nodes: number;
  leaves: number;
  folds: number;
  sel: string;
}

interface Hit {
  from: number;
  to: number;
  text: string;
}

const EMPTY: Snapshot = { lines: 0, chars: 0, nodes: 0, leaves: 0, folds: 0, sel: '' };

/** 真实统计：遍历 syntaxTree() 返回的语法树。 */
function measure(view: EditorView): Snapshot {
  let nodes = 0;
  let leaves = 0;
  try {
    const cursor = syntaxTree(view.state).cursor();
    do {
      nodes += 1;
      if (!cursor.node.firstChild) leaves += 1;
    } while (cursor.next());
  } catch {
    nodes = 0;
    leaves = 0;
  }
  const { doc, selection } = view.state;
  return {
    lines: doc.lines,
    chars: doc.length,
    nodes,
    leaves,
    folds: view.state.field(foldState, false)?.size ?? 0,
    sel: selection.main.empty ? `光标 @${selection.main.head}` : `选区 ${selection.main.from}–${selection.main.to}`,
  };
}

/**
 * CodeMirror 6：EditorState + EditorView 的扩展体系。
 * 折叠是真实的 foldCode / foldEffect 命令，补全是 localCompletionSource，搜索是官方 search 扩展。
 */
export default function CodemirrorLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const wrapBox = useRef(new Compartment());
  const langBox = useRef(new Compartment());
  const langTouched = useRef(false);

  const [lang, setLang] = useState<Lang>('javascript');
  const [wrap, setWrap] = useState(!IS_TOY);
  const [nonce, setNonce] = useState(0);
  const [stats, setStats] = useState<Snapshot>(EMPTY);
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const state = EditorState.create({
      doc: SOURCES[lang],
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        dropCursor(),
        crosshairCursor(),
        rectangularSelection(),
        EditorState.allowMultipleSelections.of(true),
        history(),
        bracketMatching(),
        closeBrackets(),
        foldGutter({ openText: '▾', closedText: '▸' }),
        codeFolding(),
        langBox.current.of(languageExtension(lang)),
        autocompletion({ override: [localCompletionSource], activateOnTyping: true }),
        highlightSelectionMatches(),
        search({ top: true }),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
        wrapBox.current.of(EditorView.lineWrapping),
        EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) setStats(measure(update.view));
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    setStats(measure(view));

    const frame = requestAnimationFrame(() => setStats(measure(view)));

    return () => {
      cancelAnimationFrame(frame);
      viewRef.current = null;
      langTouched.current = false;
      view.destroy();
      host.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // 折行是真实扩展，通过 Compartment 热切换，文档与历史都不丢。
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: wrapBox.current.reconfigure(wrap ? EditorView.lineWrapping : []) });
    setStats(measure(view));
  }, [wrap]);

  // 换语言包时同步换一份对应示例文档。
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (!langTouched.current) {
      langTouched.current = true;
      return;
    }
    view.dispatch({ effects: langBox.current.reconfigure(languageExtension(lang)) });
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: SOURCES[lang] } });
    setStats(measure(view));
    setHits([]);
  }, [lang]);

  const withView = useCallback((label: string, fn: (view: EditorView) => void) => {
    const view = viewRef.current;
    if (!view) {
      setError(`${label}：编辑器尚未创建。`);
      return;
    }
    try {
      fn(view);
      setError('');
    } catch (err) {
      setError(`${label} 抛出异常：${(err as Error).message}`);
    }
  }, []);

  const actions = useMemo(
    () => [
      {
        id: 'fold',
        label: '折叠光标行',
        title: 'foldCode(view) —— @codemirror/language 提供的真实命令',
        run: () => withView('foldCode', (v) => { foldCode(v); v.focus(); }),
      },
      {
        id: 'unfold',
        label: '展开光标行',
        title: 'unfoldCode(view)',
        run: () => withView('unfoldCode', (v) => { unfoldCode(v); v.focus(); }),
      },
      {
        id: 'foldRange',
        label: '按语法折叠',
        title: 'foldable(state, from, to) + foldEffect',
        run: () =>
          withView('foldEffect', (v) => {
            const line = v.state.doc.lineAt(v.state.selection.main.from);
            const end = line.number < v.state.doc.lines ? v.state.doc.line(line.number + 1).to : line.to;
            const range = foldable(v.state, line.from, end);
            if (!range) {
              setError(`第 ${line.number} 行没有可折叠的语法区间（foldable 返回 null）。`);
              return;
            }
            v.dispatch({ effects: foldEffect.of(range) });
            setStats(measure(v));
            v.focus();
          }),
      },
      { id: 'search', label: '打开搜索面板', title: 'openSearchPanel(view)', run: () => withView('openSearchPanel', (v) => { openSearchPanel(v); }) },
      { id: 'next', label: '查找下一个', title: 'findNext(view)', run: () => withView('findNext', (v) => { findNext(v); v.focus(); }) },
      { id: 'prev', label: '查找上一个', title: 'findPrevious(view)', run: () => withView('findPrevious', (v) => { findPrevious(v); v.focus(); }) },
      {
        id: 'query',
        label: 'SearchQuery 扫描',
        title: 'new SearchQuery({search}).getCursor(state)',
        run: () =>
          withView('SearchQuery', (v) => {
            const query = new SearchQuery({ search: 'const', caseSensitive: false, literal: true });
            const found: Hit[] = [];
            const cursor = query.getCursor(v.state);
            let hit = cursor.next();
            while (hit && !hit.done) {
              const { from, to } = hit.value;
              found.push({ from, to, text: v.state.doc.sliceString(from, to) });
              if (found.length >= 20) break;
              hit = cursor.next();
            }
            setHits(found);
            if (found.length === 0) setError('SearchQuery 扫描完成：文档里没有匹配 “const” 的字面量。');
          }),
      },
    ],
    [withView],
  );

  const stateJson = JSON.stringify(
    {
      languagePackage: lang,
      lineWrapping: wrap,
      doc: { lines: stats.lines, chars: stats.chars },
      syntaxTree: { nodes: stats.nodes, leaves: stats.leaves },
      foldedRanges: stats.folds,
      selection: stats.sel,
    },
    null,
    2,
  );

  return (
    <Lab title="CodeMirror 6 扩展体系" badge={<span className="demo-live-badge">CodeMirror 6</span>} reset={() => setNonce((n) => n + 1)}>
      <LabLayout
        controls={
          <>
            <p className="demo-caption">
              <code>EditorState.create + new EditorView</code>。折叠、搜索、补全都是官方扩展，没有自己重写。
            </p>
            <Segmented<Lang>
              label="语言包（Compartment 热切换）"
              value={lang}
              options={[
                ['javascript', 'javascript()'],
                ['markdown', 'markdown()'],
              ]}
              onChange={setLang}
            />
            <div className="lab-field">
              <span>显示选项</span>
              <label className="lab-option">
                <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
                EditorView.lineWrapping
              </label>
            </div>
            <div className="lab-codemirror__actions">
              {actions.map((a) => (
                <button key={a.id} type="button" className="lab-codemirror__btn" title={a.title} onClick={a.run}>
                  {a.label}
                </button>
              ))}
            </div>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
          </>
        }
      >
        <Stage>
          <div className="lab-codemirror__frame" ref={hostRef} />
        </Stage>
      </LabLayout>

      <Stats>
        <Stat label="行数" value={stats.lines} />
        <Stat label="字符数" value={stats.chars} />
        <Stat label="语法树节点" value={stats.nodes} />
      </Stats>
      <Status>
        语法叶子 {stats.leaves} · 折叠区块 {stats.folds} · {stats.sel}
      </Status>

      <div className="lab-editor-grid lab-editor-grid--tight">
        <DataTable
          head={['#', '范围', '匹配文本']}
          rows={hits.map((m, i) => [String(i + 1), `${m.from}–${m.to}`, m.text])}
          caption={
            hits.length === 0
              ? '点「SearchQuery 扫描」用 Text.cursor().findNext() 扫一遍真实文档'
              : `SearchQuery('const') 命中 ${hits.length} 处（上限 20）`
          }
        />
        <Code text={stateJson} onCopy={onCopy} label="EditorState 实测快照" maxHeight={260} />
      </div>
    </Lab>
  );
}
