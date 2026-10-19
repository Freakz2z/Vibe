import { useEffect, useMemo, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin, createEmptyHistoryState, type HistoryState } from '@lexical/react/LexicalHistoryPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode, $createHeadingNode, $isHeadingNode } from '@lexical/rich-text';
import {
  ListItemNode,
  ListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Stage, Stats, Stat, Status } from '../lab-kit';

/** 从一个真实的（不可变的）EditorState 快照里读出纯文本。 */
function readText(state: EditorState): string {
  try {
    return state.read(() => $getRoot().getTextContent());
  } catch {
    return '（该历史条目已失效）';
  }
}

/** 遍历真实的 EditorState 节点树——这就是 Lexical 的不可变模型。 */
function readOutline(state: EditorState): string[] {
  try {
    return state.read(() => {
      const out: string[] = [];
      const walk = (node: LexicalNode, depth: number): void => {
        out.push(`${'　'.repeat(depth)}${node.getType()}`);
        if ($isElementNode(node)) {
          for (const child of node.getChildren()) walk(child, depth + 1);
        }
      };
      walk($getRoot(), 0);
      return out;
    });
  } catch {
    return ['（无法读取该历史条目）'];
  }
}

function Toolbar({ onError }: { onError: (message: string) => void }) {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // CAN_UNDO_COMMAND / CAN_REDO_COMMAND 是真实命令，我们只观察不消费。
  useEffect(() => {
    const undo = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (enabled) => {
        setCanUndo(enabled);
        return false;
      },
      1,
    );
    const redo = editor.registerCommand(
      CAN_REDO_COMMAND,
      (enabled) => {
        setCanRedo(enabled);
        return false;
      },
      1,
    );
    return () => {
      undo();
      redo();
    };
  }, [editor]);

  const toggleHeading = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const nodes = selection.getNodes();
      if (nodes.length === 0) return;
      const allHeading = nodes.every((n) => $isHeadingNode(n));
      for (const node of nodes) node.replace(allHeading ? $createParagraphNode() : $createHeadingNode('h2'));
    });
  };

  const toggleQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const nodes = selection.getNodes();
      if (nodes.length === 0) return;
      const allQuote = nodes.every((n) => n.getType() === 'quote');
      for (const node of nodes) node.replace(allQuote ? $createParagraphNode() : new QuoteNode());
    });
  };

  return (
    <div className="lab-lexical__toolbar" role="group" aria-label="Lexical 工具栏">
      <button type="button" className="lab-lexical__btn" title="FORMAT_TEXT_COMMAND('bold')" onClick={() => {
        try {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
        } catch (error) {
          onError(`加粗失败：${(error as Error).message}`);
        }
      }}>
        加粗
      </button>
      <button
        type="button"
        className="lab-lexical__btn"
        title="FORMAT_TEXT_COMMAND('italic')"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      >
        斜体
      </button>
      <button type="button" className="lab-lexical__btn" title="切换 HeadingNode(h2)" onClick={toggleHeading}>
        标题
      </button>
      <button type="button" className="lab-lexical__btn" title="切换 QuoteNode" onClick={toggleQuote}>
        引用
      </button>
      <button
        type="button"
        className="lab-lexical__btn"
        title="INSERT_UNORDERED_LIST_COMMAND"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      >
        • 无序
      </button>
      <button
        type="button"
        className="lab-lexical__btn"
        title="INSERT_ORDERED_LIST_COMMAND"
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
      >
        1. 有序
      </button>
      <button
        type="button"
        className="lab-lexical__btn"
        title="REMOVE_LIST_COMMAND"
        onClick={() => editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)}
      >
        去列表
      </button>
      <span className="lab-lexical__sep" aria-hidden="true" />
      <button
        type="button"
        className="lab-lexical__btn"
        title="UNDO_COMMAND"
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        撤销
      </button>
      <button
        type="button"
        className="lab-lexical__btn"
        title="REDO_COMMAND"
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        重做
      </button>
    </div>
  );
}

/** 显式拆卸：摘掉根 DOM，编辑器随之释放全部监听器。 */
function DisposeOnUnmount() {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () => () => {
      editor.setRootElement(null);
    },
    [editor],
  );
  return null;
}

function StateObserver({ onChange }: {onChange: (state: EditorState) => void}) {
  const [editor] = useLexicalComposerContext();
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;
  useEffect(() => {
    callbackRef.current(editor.getEditorState());
    return editor.registerUpdateListener(({ editorState }) => callbackRef.current(editorState));
  }, [editor]);
  return null;
}

function Surface({ history, onChange, onError }: { history: HistoryState; onChange: (state: EditorState) => void; onError: (m: string) => void }) {
  return (
    <div className="lab-lexical__frame">
      <Toolbar onError={onError} />
      <div className="lab-lexical__editor">
        <RichTextPlugin
          contentEditable={<ContentEditable className="lab-lexical__ce" ariaLabel="Lexical 编辑区" />}
          placeholder={<span className="lab-lexical__placeholder">在这里输入…</span>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin externalHistoryState={history} delay={0} />
        <StateObserver onChange={onChange} />
        <DisposeOnUnmount />
      </div>
    </div>
  );
}

/**
 * Lexical：不可变 EditorState + 真实撤销/重做栈。
 * 下方历史面板读的是 HistoryPlugin 的 externalHistoryState，内容用 editorState.read() 取出。
 */
export default function LexicalLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const history = useRef<HistoryState>(createEmptyHistoryState()).current;
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [currentState, setCurrentState] = useState<EditorState | null>(null);

  const initialConfig = useMemo(
    () => ({
      namespace: 'vibe-lexical-lab',
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode],
      theme: {
        paragraph: 'lab-lexical__p',
        quote: 'lab-lexical__quote',
        heading: { h1: 'lab-lexical__h1', h2: 'lab-lexical__h2', h3: 'lab-lexical__h3' },
        list: { ul: 'lab-lexical__ul', ol: 'lab-lexical__ol', listitem: 'lab-lexical__li', nest: 'lab-lexical__nest' },
      },
      editorState: (editor: LexicalEditor) => {
        editor.update(() => {
          const root = $getRoot();
          if (root.getFirstChild() !== null) return;
          const title = $createHeadingNode('h2');
          title.append($createTextNode('Lexical 不可变编辑器'));
          const quote = new QuoteNode();
          quote.append($createTextNode('每次编辑都会生成一个全新的 EditorState，旧状态不会被就地修改。'));
          // 根节点只接受 ElementNode：直接 append 一个 TextNode 会在
          // LexicalComposer 的 render 期间抛错，错误又被 onError 回传给 setState，
          // 于是变成「渲染另一个组件时更新组件」。这里包一层 paragraph。
          const hint = $createParagraphNode();
          hint.append($createTextNode('试着输入内容，再点「撤销」看真实历史栈。'));
          root.append(title, quote, hint);
        });
      },
      // onError 可能被 LexicalComposer 的 render 期间触发（编辑器初始化就在 render 里跑），
      // 直接 setState 会触发「Cannot update a component while rendering」警告，
      // 所以把状态更新推到微任务，脱离渲染阶段。
      onError: (err: Error) => {
        const message = `Lexical 运行错误：${err.message}`;
        queueMicrotask(() => setError(message));
      },
    }),
    [],
  );

  const refresh = (state: EditorState) => { setCurrentState(state); setTick((t) => t + 1); };

  const undoDepth = history.undoStack.length;
  const redoDepth = history.redoStack.length;
  const currentText = currentState ? readText(currentState) : '';
  const outline = currentState ? readOutline(currentState) : ['（载入中）'];

  const historyRows = useMemo(
    () =>
      history.undoStack
        .map((entry, i) => {
          const text = readText(entry.editorState).replace(/\s+/g, ' ').trim();
          return [`#${i + 1}`, `${text.length} 字`, text.slice(0, 60) || '（空文档）'] as string[];
        })
        .reverse()
        .slice(0, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, history],
  );

  return (
    <Lab title="Lexical 不可变状态与历史栈" badge={<span className="demo-live-badge">Lexical 0.21</span>}>
      <LabLayout
        controls={
          <>
            <p className="demo-caption">
              编辑器由 <code>createEditor</code> 创建（经 <code>LexicalComposer</code>），注册了 Heading / Quote / List 节点。
            </p>
            <div className="lab-lexical__hint">
              <strong>真实栈深度</strong>
              <span>undo {undoDepth} · redo {redoDepth}</span>
            </div>
            <p className="lab-field__rule">
              表格内容来自 <code>HistoryPlugin externalHistoryState</code> 的真实条目，由 <code>editorState.read()</code> 读出。
            </p>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
          </>
        }
      >
        <Stage>
          <LexicalComposer initialConfig={initialConfig}>
            <Surface history={history} onChange={refresh} onError={setError} />
          </LexicalComposer>
        </Stage>
      </LabLayout>

      <Stats>
        <Stat label="undo 栈深度" value={undoDepth} />
        <Stat label="redo 栈深度" value={redoDepth} />
        <Stat label="当前状态字数" value={currentText.length} />
      </Stats>

      <div className="lab-editor-grid lab-editor-grid--tight">
        <DataTable head={['#', '长度', '该历史状态的内容']} rows={historyRows} caption="undo 栈（最新在最上）" />
        <Code text={outline.join('\n')} onCopy={onCopy} label="当前 EditorState 节点树" maxHeight={300} />
      </div>
      {undoDepth === 0 ? <Status>还没有历史条目：输入几个字后就会入栈。</Status> : null}
    </Lab>
  );
}
