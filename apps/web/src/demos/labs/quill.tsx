import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Quill, { Delta } from 'quill';
import 'quill/dist/quill.snow.css';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Stage, Stats, Stat, Status } from '../lab-kit';

const SEED_DELTA = new Delta()
  .insert('Delta 是 Quill 的文档模型\n')
  .insert('每一条 op 描述一次插入、删除或属性保留，而不是一段 HTML 字符串。\n')
  .insert('因此同一个文档可以无损地来回合成（compose）。\n');

function opSummary(op: Record<string, unknown>): string {
  const kind = Object.keys(op)[0] ?? '?';
  const value = op[kind];
  const attrs = op.attributes ? ` ${JSON.stringify(op.attributes)}` : '';
  if (kind === 'insert' && typeof value === 'object' && value !== null) {
    return `insert(embed:${Object.keys(value as Record<string, unknown>)[0]})${attrs}`;
  }
  return `${kind}(${typeof value === 'string' ? JSON.stringify(value.slice(0, 18)) : value})${attrs}`;
}

export type QuillSource = 'user' | 'api' | 'silent';

/**
 * Quill 2：只展示它的 Delta 文档模型。
 * 刻意不调用 getSemanticHTML()（导出 HTML 的路径），全部走 getContents / updateContents / setContents / setText。
 */
export default function QuillLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const seqRef = useRef(0);

  const [contents, setContents] = useState<Delta | null>(null);
  const [log, setLog] = useState<{ id: number; source: string; ops: number; preview: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const quill = new Quill(host, {
      theme: 'snow',
      placeholder: '在 Quill 里输入，或用左侧按钮改写 Delta…',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block'],
          [{ align: [] }],
          ['clean'],
        ],
      },
    });

    quill.setContents(SEED_DELTA, 'silent');
    quillRef.current = quill;

    const publish = (source: QuillSource, ops: number, preview: string) => {
      seqRef.current += 1;
      setLog((prev) => [{ id: seqRef.current, source, ops, preview }, ...prev].slice(0, 20));
      try {
        setContents(quill.getContents());
      } catch (err) {
        setError(`读取 getContents() 失败：${(err as Error).message}`);
      }
    };

    const onTextChange = (delta: Delta, _old: Delta, source: QuillSource) => {
      publish(source, delta.ops.length, JSON.stringify(delta.ops).slice(0, 80));
    };

    quill.on('text-change', onTextChange);
    publish('silent', SEED_DELTA.ops.length, '（初始化）');

    return () => {
      quill.off('text-change', onTextChange);
      quillRef.current = null;
      host.replaceChildren();
    };
  }, []);

  const guard = useCallback((label: string, fn: () => void) => {
    const quill = quillRef.current;
    if (!quill) {
      setError(`${label}：编辑器尚未创建。`);
      return;
    }
    try {
      fn();
      setError('');
    } catch (err) {
      setError(`${label} 抛出异常：${(err as Error).message}`);
    }
  }, []);

  const actions = useMemo(
    () => [
      {
        id: 'append',
        label: 'updateContents 追加',
        title: 'quill.updateContents(new Delta().insert(…, {bold:true}), "api")',
        run: () =>
          guard('updateContents', () => {
            const quill = quillRef.current;
            if (!quill) return;
            const at = quill.getLength() - 1;
            const delta = new Delta().retain(at).insert('程序化插入的一段加粗文本。\n', { bold: true });
            quill.updateContents(delta, 'api');
            quill.setSelection(quill.getLength() - 1, 0, 'api');
          }),
      },
      {
        id: 'compose',
        label: 'compose 合成',
        title: 'base.compose(attributes) —— 保留 20 个字符并加粗',
        run: () =>
          guard('compose', () => {
            const quill = quillRef.current;
            if (!quill) return;
            const base = new Delta().insert('Delta compose 保留长度并叠加属性。\n');
            const emphasise = new Delta().retain(5, { bold: true });
            const merged = base.compose(emphasise);
            quill.setContents(merged, 'api');
          }),
      },
      {
        id: 'setContents',
        label: 'setContents 替换',
        title: 'quill.setContents(Delta)',
        run: () =>
          guard('setContents', () => {
            const quill = quillRef.current;
            if (!quill) return;
            const next = new Delta()
              .insert({ header: 2 })
              .insert('由 setContents 写入\n')
              .insert('第二条 op 带 header 属性。\n')
              .insert('\n');
            quill.setContents(next, 'api');
          }),
      },
      {
        id: 'setText',
        label: 'setText 清空',
        title: 'quill.setText(text, "api")',
        run: () =>
          guard('setText', () => {
            const quill = quillRef.current;
            if (!quill) return;
            quill.setText('setText 把整篇文档替换成一段纯文本，Delta 随之塌缩为单条 insert op。\n', 'api');
          }),
      },
      {
        id: 'delete',
        label: '删除首个块',
        title: 'quill.deleteText(0, length, "api")',
        run: () =>
          guard('deleteText', () => {
            const quill = quillRef.current;
            if (!quill) return;
            const length = quill.getText(0, quill.getLength()).indexOf('\n');
            if (length < 0) {
              setError('deleteText：文档没有可删除的首行。');
              return;
            }
            quill.deleteText(0, length + 1, 'api');
          }),
      },
      {
        id: 'format',
        label: 'formatText 加粗',
        title: 'quill.formatText(index, length, "bold", true, "api")',
        run: () =>
          guard('formatText', () => {
            const quill = quillRef.current;
            if (!quill) return;
            const text = quill.getText(0, quill.getLength());
            const end = text.indexOf('\n');
            if (end <= 0) {
              setError('formatText：首行为空，没有可加粗的内容。');
              return;
            }
            quill.formatText(0, end, 'bold', true, 'api');
          }),
      },
    ],
    [guard],
  );

  const contentsText = contents ? JSON.stringify(contents.ops, null, 2) : '';
  const opRows = (contents?.ops ?? []).map((op, i) => [
    String(i),
    opSummary(op as unknown as Record<string, unknown>),
    JSON.stringify((op as { attributes?: unknown }).attributes ?? null),
  ]);

  const ops = contents?.ops ?? [];
  const empty = ops.length <= 1 && ops.every((op) => op.insert === '\n');

  return (
    <Lab title="Quill Delta 文档模型" badge={<span className="demo-live-badge">Quill 2.0</span>}>
      <LabLayout
        controls={
          <>
            <p className="demo-caption">
              只使用 Delta API：<code>getContents / updateContents / setContents / setText / compose</code>。
              本示例<b>不调用</b> <code>getSemanticHTML()</code>，也不会把 Quill 的 HTML 导出结果插入页面。
            </p>
            <div className="lab-quill__actions">
              {actions.map((a) => (
                <button key={a.id} type="button" className="lab-quill__btn" title={a.title} onClick={a.run}>
                  {a.label}
                </button>
              ))}
            </div>
            <p className="lab-field__rule">工具栏中的「clean」是 Quill 自带的粘贴清洗器，用于把剪贴板 HTML 压成纯格式。</p>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
          </>
        }
      >
        <Stage>
          <div className="lab-quill__frame">
            <div ref={hostRef} className="lab-quill__host" />
          </div>
        </Stage>
      </LabLayout>

      <Stats>
        <Stat label="op 条数" value={contents?.ops.length ?? 0} />
        <Stat label="文档长度" value={contents ? contents.length() : 0} />
        <Stat label="已记录变更" value={log.length} />
      </Stats>
      {empty ? <Status tone="warn">文档已被清空（仅剩一个换行 op）。</Status> : null}

      <div className="lab-editor-grid lab-editor-grid--tight">
        <DataTable head={['#', 'op', 'attributes']} rows={opRows} caption="getContents().ops —— 真实 Delta 操作序列" />
        <div>
          <Code text={contentsText || '（尚未初始化）'} onCopy={onCopy} label="getContents() JSON" maxHeight={300} />
          <div className="lab-quill__log-wrap">
            <DataTable
              head={['#', 'source', 'ops', '预览']}
              rows={log.map((l) => [String(l.id), l.source, String(l.ops), l.preview])}
              caption="text-change 事件（新→旧）"
            />
          </div>
        </div>
      </div>
    </Lab>
  );
}
