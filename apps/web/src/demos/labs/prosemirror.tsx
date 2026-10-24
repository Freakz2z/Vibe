import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes, liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { history, undo, redo } from 'prosemirror-history';
import { baseKeymap, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { EditorState, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from '@tiptap/pm/keymap';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Stage, Stats, Stat, Status } from '../lab-kit';

/** 本仓库里 prosemirror-model 存在多份副本，这里统一使用 schema-basic 所依赖的那一份。 */
type PMSchema = typeof basicSchema;
type PMNode = ReturnType<PMSchema['nodeFromJSON']>;

type SchemaCtor = new (spec: { nodes: unknown; marks: unknown }) => PMSchema;

const INITIAL_DOC = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'ProseMirror 事务与步骤' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '左侧是真实的 ' },
        { type: 'text', text: 'EditorView', marks: [{ type: 'code' }] },
        { type: 'text', text: '，可以直接输入。右侧记录每一次 dispatchTransaction 收到的真实事务。' },
      ],
    },
    {
      type: 'bullet_list',
      content: [
        { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: '每个事务由若干 Step 组成' }] }] },
        { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'step.toJSON() 是可序列化的最小变更单元' }] }] },
        { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: '历史插件靠给事务加 meta 实现撤销' }] }] },
      ],
    },
    {
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '试着输入内容，然后用左侧按钮注入事务，再撤销。' }] }],
    },
  ],
};

interface LogRow {
  id: number;
  steps: number;
  docChanged: boolean;
  labels: string;
  preview: string;
}

function buildSchema(): PMSchema {
  const SchemaC = basicSchema.constructor as unknown as SchemaCtor;
  return new SchemaC({
    nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block'),
    marks: basicSchema.spec.marks,
  });
}

function countNodes(node: PMNode): number {
  let total = 1;
  node.forEach((child) => {
    total += countNodes(child);
  });
  return total;
}

function stepType(step: { stepType?: string }, ctorName: string): string {
  return step.stepType ?? ctorName;
}

/**
 * ProseMirror 核心：不使用任何 React 封装，直接 new EditorView。
 * 展示点是事务（Transaction）与步骤（Step）的真实结构。
 */
export default function ProsemirrorLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const schemaRef = useRef<PMSchema | null>(null);
  const seqRef = useRef(0);

  const [rows, setRows] = useState<LogRow[]>([]);
  const [stepJson, setStepJson] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ blocks: 0, nodes: 0, chars: 0, sel: '' });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const schema = buildSchema();
    schemaRef.current = schema;

    let doc: PMNode;
    try {
      doc = schema.nodeFromJSON(INITIAL_DOC);
    } catch (err) {
      setError(`初始文档无法解析：${(err as Error).message}`);
      return;
    }

    const syncStats = (s: EditorState) => {
      const { doc: d, selection } = s;
      setStats({
        blocks: d.childCount,
        nodes: countNodes(d),
        chars: d.textContent.length,
        sel: selection.from === selection.to ? `光标 @${selection.from}` : `选区 ${selection.from}–${selection.to}（${selection.to - selection.from} 字）`,
      });
    };

    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
        keymap({
          Enter: splitListItem(schema.nodes.list_item),
          Tab: sinkListItem(schema.nodes.list_item),
          'Shift-Tab': liftListItem(schema.nodes.list_item),
          'Mod-]': wrapInList(schema.nodes.bullet_list),
        }),
        keymap(baseKeymap),
      ],
    });

    const view = new EditorView(host, {
      state,
      attributes: { class: 'lab-prosemirror__surface', 'aria-label': 'ProseMirror 编辑区' },
      dispatchTransaction(tr: Transaction) {
        const next = view.state.apply(tr);
        view.updateState(next);

        const json = tr.steps.map((s) => s.toJSON());
        seqRef.current += 1;
        const id = seqRef.current;
        const labels = tr.steps.map((s) => stepType(s as { stepType?: string }, s.constructor.name)).join(' + ') || '（无 step）';

        setRows((prev) =>
          [{ id, steps: tr.steps.length, docChanged: tr.docChanged, labels, preview: JSON.stringify(json).slice(0, 90) }, ...prev].slice(0, 25),
        );
        setStepJson(JSON.stringify({ id, docChanged: tr.docChanged, stepCount: tr.steps.length, steps: json }, null, 2));
        syncStats(next);
      },
    });

    viewRef.current = view;
    syncStats(view.state);
    setStepJson('// 还没有事务。在编辑器里输入，或点左侧按钮注入一个事务。');

    return () => {
      viewRef.current = null;
      schemaRef.current = null;
      view.destroy();
      host.replaceChildren();
    };
  }, []);

  const run = useCallback((label: string, fn: (view: EditorView, schema: PMSchema) => boolean) => {
    const view = viewRef.current;
    const schema = schemaRef.current;
    if (!view || !schema) {
      setError(`${label}：编辑器尚未就绪。`);
      return;
    }
    try {
      const ok = fn(view, schema);
      setError(ok ? '' : `${label}：当前位置不允许执行这个变换（ProseMirror 返回 false）。`);
    } catch (err) {
      setError(`${label} 抛出异常：${(err as Error).message}`);
    }
  }, []);

  const actions = useMemo(
    () => [
      {
        id: 'insert',
        label: '插入文本',
        title: 'tr.insertText(text, from)',
        run: () =>
          run('插入文本', (view) => {
            view.dispatch(view.state.tr.insertText('事务插入的文本 ', view.state.selection.from));
            view.focus();
            return true;
          }),
      },
      {
        id: 'h2',
        label: '设为 H2',
        title: 'setBlockType(heading, { level: 2 })',
        run: () =>
          run('设为 H2', (view, schema) => {
            const ok = setBlockType(schema.nodes.heading, { level: 2 })(view.state, view.dispatch);
            view.focus();
            return ok;
          }),
      },
      {
        id: 'p',
        label: '还原段落',
        title: 'setBlockType(paragraph)',
        run: () =>
          run('还原段落', (view, schema) => {
            const ok = setBlockType(schema.nodes.paragraph)(view.state, view.dispatch);
            view.focus();
            return ok;
          }),
      },
      {
        id: 'quote',
        label: '包裹引用',
        title: 'wrapIn(blockquote)',
        run: () =>
          run('包裹引用', (view, schema) => {
            const ok = wrapIn(schema.nodes.blockquote)(view.state, view.dispatch);
            view.focus();
            return ok;
          }),
      },
      {
        id: 'bold',
        label: '切换加粗',
        title: 'toggleMark(strong)',
        run: () =>
          run('切换加粗', (view, schema) => {
            const ok = toggleMark(schema.marks.strong)(view.state, view.dispatch);
            view.focus();
            return ok;
          }),
      },
      {
        id: 'undo',
        label: '撤销',
        title: 'history 插件的 undo()',
        run: () =>
          run('撤销', (view) => {
            const ok = undo(view.state, view.dispatch);
            view.focus();
            return ok;
          }),
      },
      {
        id: 'redo',
        label: '重做',
        title: 'history 插件的 redo()',
        run: () =>
          run('重做', (view) => {
            const ok = redo(view.state, view.dispatch);
            view.focus();
            return ok;
          }),
      },
    ],
    [run],
  );

  const clearLog = () => {
    setRows([]);
    setStepJson('// 日志已清空（编辑器内容未改动）。');
  };

  return (
    <Lab title="ProseMirror 事务与步骤" badge={<span className="demo-live-badge">ProseMirror 1.42</span>} reset={clearLog}>
      <LabLayout
        controls={
          <>
            <p className="demo-caption">
              直接创建 <code>EditorState</code> + <code>EditorView</code>，没有 React 封装。按钮注入的都是真实事务。
            </p>
            <div className="lab-prosemirror__actions">
              {actions.map((a) => (
                <button key={a.id} type="button" className="lab-prosemirror__btn" title={a.title} onClick={a.run}>
                  {a.label}
                </button>
              ))}
            </div>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
          </>
        }
      >
        <Stage>
          <div className="lab-prosemirror__frame" ref={hostRef} />
        </Stage>
      </LabLayout>

      <Stats>
        <Stat label="顶层块" value={stats.blocks} />
        <Stat label="全部节点" value={stats.nodes} />
        <Stat label="字符数" value={stats.chars} />
      </Stats>
      <Status>{stats.sel}</Status>

      <div className="lab-editor-grid lab-editor-grid--tight">
        <DataTable
          head={['#', 'step 数', 'docChanged', '步骤类型', 'step.toJSON() 预览']}
          rows={rows.map((r) => [String(r.id), String(r.steps), r.docChanged ? '是' : '否', r.labels, r.preview])}
          caption="最近 25 个事务（新→旧）"
        />
        <Code text={stepJson} onCopy={onCopy} output label="step.toJSON()" maxHeight={320} />
      </div>
      {rows.length === 0 ? <Status>事务日志为空。在编辑器里输入，或点上方任意按钮。</Status> : null}
    </Lab>
  );
}
