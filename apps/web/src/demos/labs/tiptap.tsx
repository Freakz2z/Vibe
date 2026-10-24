import { useCallback, useMemo, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, LabLayout, Stage, Stats, Stat, Status } from '../lab-kit';

const INITIAL_CONTENT = `<h1>Tiptap 结构化文档</h1>
<p>左键选中文字后，用工具栏套用 <strong>加粗</strong>；右侧 <code>editor.getJSON()</code> 会同步输出 <em>结构化 JSON</em>。</p>
<ul><li>文档不是 HTML 字符串，而是一棵节点树</li><li>每个节点都有 type 与 attrs</li><li>渲染层与数据层彻底分离</li></ul>
<blockquote><p>ProseMirror 的 <code>doc</code> 就是一棵不可变树。</p></blockquote>
<h2>下一步</h2>
<p>试试撤销、切换列表级别，或点「重置」重新开始。</p>`;

interface ToolbarButton {
  id: string;
  label: string;
  title: string;
  run: () => void;
  isOn: () => boolean;
}

function countNodes(node: { content?: unknown[] } | null | undefined): number {
  if (!node) return 0;
  const children = node.content ?? [];
  let total = 1;
  for (const child of children as { content?: unknown[] }[]) total += countNodes(child);
  return total;
}

function textOf(node: { content?: unknown[] } | null | undefined): string {
  if (!node) return '';
  const children = node.content ?? [];
  let out = '';
  for (const child of children as { text?: string; content?: unknown[] }[]) {
    out += child.text ?? textOf(child);
  }
  return out;
}

/**
 * Tiptap v3：真正的富文本内核 + 结构化 JSON 输出。
 * 展示点是 getJSON()——Tiptap 把整篇文档暴露成 ProseMirror 的节点树，
 * 而不是一段 HTML 字符串。
 */
export default function TiptapLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [nonce, setNonce] = useState(0);
  const [notice, setNotice] = useState<string>('');

  const editor = useEditor(
    {
      // 注意：@tiptap/react 与 @tiptap/starter-kit 必须解析到**同一个**
      // @tiptap/core / @tiptap/pm / prosemirror-state。只要磁盘上存在第二份
      // prosemirror-state，它的 `createKey` 计数器就会和第一份从 plugin$1 开始
      // 重新数，于是两个不同实例拿到同一个 plugin key，编辑器在
      // EditorState.reconfigure 时抛 “Adding different instances of a keyed plugin”。
      extensions: [StarterKit],
      content: INITIAL_CONTENT,
      editorProps: {
        attributes: { class: 'lab-tiptap__surface', 'aria-label': 'Tiptap 编辑区' },
      },
      onUpdate({ editor: instance }) {
        setNotice(`第 ${instance.state.doc.content.size} 个 ProseMirror 位置单位已更新`);
      },
    },
    [nonce],
  );

  // v3 的 useEditorState：按事务重算选中值，避免每次 keystroke 全量 re-render。
  const snapshot = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      json: instance ? instance.getJSON() : null,
      words: instance ? instance.state.doc.textContent.length : 0,
      blocks: instance ? instance.state.doc.childCount : 0,
    }),
  });

  const json = snapshot?.json ?? null;
  const jsonText = json ? JSON.stringify(json, null, 2) : '';

  const toggle = useCallback(
    (kind: 'bold' | 'italic' | 'strike' | 'code' | 'bullet' | 'ordered' | 'quote' | 'codeblock') => {
      if (!editor) return;
      const chain = editor.chain().focus();
      if (kind === 'bold') chain.toggleBold().run();
      else if (kind === 'italic') chain.toggleItalic().run();
      else if (kind === 'strike') chain.toggleStrike().run();
      else if (kind === 'code') chain.toggleCode().run();
      else if (kind === 'bullet') chain.toggleBulletList().run();
      else if (kind === 'ordered') chain.toggleOrderedList().run();
      else if (kind === 'quote') chain.toggleBlockquote().run();
      else if (kind === 'codeblock') chain.toggleCodeBlock().run();
    },
    [editor],
  );

  const toolbar = useMemo<ToolbarButton[]>(() => {
    if (!editor) return [];
    const buttons: ToolbarButton[] = [
      { id: 'bold', label: 'B', title: '加粗 toggleBold()', run: () => toggle('bold'), isOn: () => editor.isActive('bold') },
      { id: 'italic', label: 'I', title: '斜体 toggleItalic()', run: () => toggle('italic'), isOn: () => editor.isActive('italic') },
      { id: 'strike', label: 'S', title: '删除线 toggleStrike()', run: () => toggle('strike'), isOn: () => editor.isActive('strike') },
      { id: 'code', label: '</>', title: '行内代码 toggleCode()', run: () => toggle('code'), isOn: () => editor.isActive('code') },
      {
        id: 'h1',
        label: 'H1',
        title: '一级标题 toggleHeading({level:1})',
        run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isOn: () => editor.isActive('heading', { level: 1 }),
      },
      {
        id: 'h2',
        label: 'H2',
        title: '二级标题 toggleHeading({level:2})',
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isOn: () => editor.isActive('heading', { level: 2 }),
      },
      {
        id: 'ul',
        label: '• 列表',
        title: '无序列表 toggleBulletList()',
        run: () => toggle('bullet'),
        isOn: () => editor.isActive('bulletList'),
      },
      {
        id: 'ol',
        label: '1. 列表',
        title: '有序列表 toggleOrderedList()',
        run: () => toggle('ordered'),
        isOn: () => editor.isActive('orderedList'),
      },
      { id: 'quote', label: '引用', title: '引用块 toggleBlockquote()', run: () => toggle('quote'), isOn: () => editor.isActive('blockquote') },
      { id: 'pre', label: '代码块', title: '代码块 toggleCodeBlock()', run: () => toggle('codeblock'), isOn: () => editor.isActive('codeBlock') },
    ];
    return buttons;
  }, [editor, toggle]);

  const undo = useCallback(() => editor?.chain().focus().undo().run(), [editor]);
  const redo = useCallback(() => editor?.chain().focus().redo().run(), [editor]);
  const clearAll = useCallback(() => {
    editor?.chain().focus().clearNodes().unsetAllMarks().run();
    editor?.commands.clearContent();
  }, [editor]);

  const doc = json as { content?: { content?: unknown[] }[] } | null;
  const nodes = countNodes(doc);
  const plain = textOf(doc);
  const empty = plain.trim().length === 0;

  return (
    <Lab
      title="Tiptap 结构化文档"
      badge={<span className="demo-live-badge">Tiptap v3</span>}
      reset={() => setNonce((n) => n + 1)}
    >
      <LabLayout
        layout="rich"
        controls={
          <>
            <p className="demo-caption">
              编辑器由 <code>useEditor + StarterKit</code> 创建，右侧 JSON 来自真实的 <code>editor.getJSON()</code>。
            </p>
            <div className="lab-tiptap__toolbar" role="group" aria-label="格式工具栏">
              {toolbar.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`lab-tiptap__btn${b.isOn() ? ' is-active' : ''}`}
                  title={b.title}
                  aria-pressed={b.isOn()}
                  onClick={b.run}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="lab-options">
              <button type="button" className="button button--secondary button--small" onClick={undo}>
                撤销
              </button>
              <button type="button" className="button button--secondary button--small" onClick={redo}>
                重做
              </button>
              <button type="button" className="button button--secondary button--small" onClick={clearAll}>
                清空文档
              </button>
            </div>
            {empty ? (
              <Status tone="warn">文档已清空：getJSON() 现在只返回一个 paragraph 空节点。</Status>
            ) : (
              <Status>节点总数 {nodes}，纯文本 {plain.length} 字。</Status>
            )}
            {notice ? <Status>{notice}</Status> : null}
          </>
        }
      >
        <Stage>
          <div className="lab-tiptap__frame">
            {editor ? (
              <EditorContent editor={editor} />
            ) : (
              <p className="lab-status">正在创建编辑器实例…</p>
            )}
          </div>
        </Stage>
      </LabLayout>

      <div className="lab-tiptap__grid">
        <Stats>
          <Stat label="顶层节点" value={snapshot?.blocks ?? 0} />
          <Stat label="全部节点" value={nodes} />
          <Stat label="字符数" value={snapshot?.words ?? 0} />
        </Stats>
        <Code text={jsonText || '（编辑器尚未创建）'} onCopy={onCopy} label="getJSON() 输出" maxHeight={300} />
      </div>
    </Lab>
  );
}
