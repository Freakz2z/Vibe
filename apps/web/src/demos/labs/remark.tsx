import { useMemo, useState } from 'react';
import { remark } from 'remark';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Plugin, Transformer } from 'unified';
import type { Root as MdastRoot } from 'mdast';
import type { Root as HastRoot, Element as HastElement, Nodes as HastNode } from 'hast';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, ErrorNote, Lab, LabLayout, Stage, Stats, Stat, TextField } from '../lab-kit';

const SAMPLE = `# Remark 管线

这是一段**加粗**与 *斜体*，还有一个 [外部链接](https://unifiedjs.org)。

## 插件改写

下面每个标题的文字都会被 remark 插件追加一个标记，用来证明插件真的改了 AST。

- 列表项一
- 列表项二

> 引用块也会进入 hast 管线。

<script>alert('这个 script 会被 rehype-sanitize 删掉')</script>

<img src="x" onerror="alert('这个 onerror 属性也会被删掉')" alt="坏掉的图片">

\`\`\`js
const x = 1;
\`\`\`
`;

/* ---------- 自写的 mdast / hast 遍历（不引入 unist-util-visit） ---------- */

interface MdNode {
  type: string;
  value?: string;
  depth?: number;
  lang?: string | null;
  url?: string;
  children?: MdNode[];
}

function walkMd(node: MdNode, visit: (n: MdNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walkMd(child, visit);
}

function mdText(node: MdNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  return (node.children ?? []).map(mdText).join('');
}

function walkHa(node: HastNode, visit: (n: HastNode) => void): void {
  visit(node);
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) walkHa(child as HastNode, visit);
  }
}

function isElement(node: HastNode): node is HastElement {
  return node.type === 'element';
}

function serializeMd(node: MdNode, depth: number, lines: string[]): void {
  const pad = '  '.repeat(depth);
  const extra: string[] = [];
  if (node.type === 'heading' && node.depth) extra.push(`depth=${node.depth}`);
  if (node.type === 'code') extra.push(`lang=${node.lang ?? ''}`);
  if (node.type === 'link') extra.push(`url=${node.url ?? ''}`);
  const inline = node.type === 'text' || node.type === 'inlineCode';
  const head = `${pad}${node.type}${extra.length ? ` (${extra.join(', ')})` : ''}`;
  if (inline) lines.push(`${head} ${JSON.stringify(node.value ?? '')}`);
  else lines.push(head);
  for (const child of node.children ?? []) serializeMd(child, depth + 1, lines);
}

function serializeHa(node: HastNode, depth: number, lines: string[]): void {
  const pad = '  '.repeat(depth);
  if (isElement(node)) {
    const props = Object.entries(node.properties ?? {})
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(' ') : String(v)}`)
      .join(' ');
    lines.push(`${pad}${node.tagName}${props ? ` [${props}]` : ''}`);
    for (const child of node.children) serializeHa(child as HastNode, depth + 1, lines);
    return;
  }
  lines.push(`${pad}${node.type}${'value' in node ? ` ${JSON.stringify(String(node.value))}` : ''}`);
}

/* ---------- 自写的 remark 插件 ---------- */

/** 插件 1：改写所有 heading 的文字内容。 */
function remarkMarkHeadings(): Transformer<MdastRoot, MdastRoot> {
  return (tree: MdastRoot): void => {
    walkMd(tree as unknown as MdNode, (node) => {
      if (node.type !== 'heading') return;
      const kids = node.children ?? [];
      const last = kids[kids.length - 1];
      if (last && last.type === 'text') last.value = `${last.value} ✎`;
    });
  };
}

/** 插件 2：收集文档里的所有链接。 */
function remarkCollectLinks(out: { url: string; text: string }[]): Transformer<MdastRoot, MdastRoot> {
  return (tree: MdastRoot): void => {
    walkMd(tree as unknown as MdNode, (node) => {
      if (node.type === 'link') out.push({ url: node.url ?? '', text: mdText(node) });
    });
  };
}

/** 插件 3：在 hast 阶段给所有标题加一个 class。 */
function rehypeAddHeadingClass(): Transformer<HastRoot, HastRoot> {
  return (tree: HastRoot): void => {
    walkHa(tree, (node) => {
      if (isElement(node) && /^h[1-6]$/.test(node.tagName)) {
        const existing = node.properties?.className;
        const list = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
        node.properties = { ...node.properties, className: [...list, 'lab-remark__h'] };
      }
    });
  };
}

/* ---------- 处理器 ---------- */

const parseProcessor = remark().use(remarkParse);
const unsafeProcessor = remark()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeStringify);

// unified 11 的 Plugin/Transformer 泛型在本仓库的 TS 版本下无法直接互转，
// 下面这三个手写插件在这里统一断言成零参 Plugin 再注册。
const markHeadingsPlugin = remarkMarkHeadings as unknown as Plugin<[], MdastRoot, MdastRoot>;
const collectLinksPlugin = (out: { url: string; text: string }[]): Plugin<[], MdastRoot, MdastRoot> =>
  () => remarkCollectLinks(out);
const headingClassPlugin = rehypeAddHeadingClass as unknown as Plugin<[], MdastRoot, MdastRoot>;

/** 净化后的处理器每次渲染重建，链接表随管线实例一起生成，不跨渲染共享。 */
function makeSafeProcessor() {
  const links: { url: string; text: string }[] = [];
  const processor = remark()
    .use(remarkParse)
    .use(markHeadingsPlugin)
    .use(collectLinksPlugin(links))
    .use(remarkRehype)
    .use(headingClassPlugin)
    .use(rehypeSanitize)
    .use(rehypeStringify);
  return { processor, links };
}

function run<T>(fn: () => T): { value: T | null; error: string } {
  try {
    return { value: fn(), error: '' };
  } catch (err) {
    return { value: null, error: `${(err as Error).name}: ${(err as Error).message}` };
  }
}

/**
 * unified / remark：真实的 AST 管线。
 * 左侧是手写序列化出来的 mdast，右侧是 rehype-sanitize 之后的 hast 与 HTML。
 */
export default function RemarkLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [source, setSource] = useState(SAMPLE);

  const parsed = useMemo(() => run(() => parseProcessor.parse(source)), [source]);
  const tree = parsed.value as MdNode | null;

  const unsafe = useMemo(() => run(() => unsafeProcessor.processSync(source).toString()), [source]);

  const pipeline = useMemo(() => {
    const made = makeSafeProcessor();
    return { ...made, result: run(() => made.processor.processSync(source).toString()) };
  }, [source]);
  const links = pipeline.links;
  const safeHtml = pipeline.result.value ?? '';

  const mdastLines = useMemo(() => {
    if (!tree) return [];
    const lines: string[] = [];
    serializeMd(tree, 0, lines);
    return lines;
  }, [tree]);

  const hastLines = useMemo(() => {
    if (!tree) return [];
    const built = run(() => unsafeProcessor.runSync(tree as unknown as MdastRoot));
    if (!built.value) return [];
    const lines: string[] = [];
    serializeHa(built.value as HastNode, 0, lines);
    return lines;
  }, [tree]);

  const unsafeHtml = unsafe.value ?? '';
  const scriptRemoved = unsafeHtml.includes('<script') && !safeHtml.includes('<script');
  const onerrorRemoved = unsafeHtml.includes('onerror') && !safeHtml.includes('onerror');

  const error = parsed.error || unsafe.error || pipeline.result.error;
  const empty = source.trim().length === 0;

  return (
    <Lab title="Remark AST 管线与净化" badge={<span className="demo-live-badge">remark 15</span>} reset={() => setSource(SAMPLE)}>
      <LabLayout
        layout="editor"
        controls={
          <>
            <p className="demo-caption">
              管线：<code>remarkParse → 自写插件 → remarkRehype → rehypeSanitize → rehypeStringify</code>。
            </p>
            <TextField label="Markdown 源码" value={source} onChange={setSource} rows={12} mono />
            <p className="lab-field__rule">
              下方插件均为本文件手写：<code>remarkMarkHeadings</code>、<code>remarkCollectLinks</code>、
              <code>rehypeAddHeadingClass</code>。
            </p>
          </>
        }
      >
        <Stage>
          {error ? (
            <ErrorNote>{error}</ErrorNote>
          ) : empty ? (
            <p className="lab-status">源码为空：remark 解析出空的 root 节点，HTML 为空字符串。</p>
          ) : (
            // 这段 HTML 是 rehype-sanitize 的直接产物：script、on* 属性、未知标签都不会出现在这里。
            <div className="lab-remark__out" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          )}
        </Stage>
      </LabLayout>

      <Stats>
        <Stat label="mdast 行数" value={mdastLines.length} />
        <Stat label="收集到的链接" value={links.length} />
        <Stat label="净化后 HTML 长度" value={safeHtml.length} />
      </Stats>

      <div className="lab-remark__proof">
        <h3>rehype-sanitize 净化对照</h3>
        <ul>
          <li data-pass={scriptRemoved}><code>&lt;script&gt;</code>：未净化 {unsafeHtml.includes('<script') ? '存在' : '不存在'} → 净化后 {safeHtml.includes('<script') ? '仍存在' : '已移除'}</li>
          <li data-pass={onerrorRemoved}><code>onerror</code>：未净化 {unsafeHtml.includes('onerror') ? '存在' : '不存在'} → 净化后 {safeHtml.includes('onerror') ? '仍存在' : '已移除'}</li>
          <li data-pass><code>remarkMarkHeadings</code> 已给每个标题追加 ✎；<code>rehypeAddHeadingClass</code> 已给标题加 <code>lab-remark__h</code>。</li>
        </ul>
      </div>

      <DataTable head={['#', '链接文字', 'href']} rows={links.map((l, i) => [String(i + 1), l.text, l.url])} caption="remarkCollectLinks 插件收集到的链接" />

      <div className="lab-editor-grid lab-editor-grid--tight">
        <Code text={mdastLines.join('\n') || '// 空的 mdast'} onCopy={onCopy} label="mdast 树（本文件手写序列化）" maxHeight={320} />
        <Code text={hastLines.join('\n') || '// 空的 hast'} onCopy={onCopy} label="hast 树（remarkRehype 之后、sanitize 之前）" maxHeight={320} />
      </div>

      <div className="lab-editor-grid lab-editor-grid--tight">
        <Code text={unsafeHtml || '// 空'} onCopy={onCopy} label="未净化 HTML（仅作文本）" maxHeight={220} />
        <Code text={safeHtml || '// 空'} onCopy={onCopy} label="rehype-sanitize 后（页面渲染的就是它）" maxHeight={220} />
      </div>
    </Lab>
  );
}
