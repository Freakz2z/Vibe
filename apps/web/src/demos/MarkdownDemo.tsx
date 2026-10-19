import { useMemo, useState, type ReactNode } from 'react';
import { RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';

const MAX_SOURCE_LENGTH = 12000;

const EXAMPLE = `# 安全预览示例

在左侧写 **Markdown**，右侧会实时更新。这个预览器只输出 React 文本与安全元素，不执行 HTML。

## 可以试试

- 用 \`**粗体**\` 强调一句话
- 把列表、引用和代码放在一起
- 粘贴一段 HTML，看看它只会作为文字出现

> 预览不会渲染原始 HTML，也不会执行脚本。

\`\`\`ts
const vibe = '安全第一';
console.log(vibe);
\`\`\`

[打开 Vibe 工具集](https://vibe.freakz2z.com)

<b>这是一个 HTML 标签，会按纯文本显示</b>`;

function safeLink(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    return null;
  }
  return null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-inline-${tokenIndex}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
      const href = link ? safeLink(link[2]) : null;
      if (link && href) {
        nodes.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    cursor = match.index + token.length;
    tokenIndex += 1;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function startsBlock(line: string): boolean {
  return (
    /^#{1,4}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*+]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^```/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())
  );
}

function parseMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let index = 0;
  let blockIndex = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const key = `md-block-${blockIndex}`;

    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      nodes.push(
        <div className="md-code-block" key={key}>
          {language ? <span className="md-code-lang">{language}</span> : null}
          <pre>
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>,
      );
      blockIndex += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const HeadingTag = level === 1 ? 'h2' : level === 2 ? 'h3' : level === 3 ? 'h4' : 'h5';
      nodes.push(<HeadingTag key={key}>{renderInline(heading[2], key)}</HeadingTag>);
      index += 1;
      blockIndex += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      nodes.push(
        <blockquote key={key}>
          {quoteLines.map((quote, quoteIndex) => (
            <p key={`${key}-quote-${quoteIndex}`}>{renderInline(quote, `${key}-${quoteIndex}`)}</p>
          ))}
        </blockquote>,
      );
      blockIndex += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*+]\s+/, ''));
        index += 1;
      }
      nodes.push(
        <ul key={key}>
          {items.map((item, itemIndex) => (
            <li key={`${key}-li-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      blockIndex += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      nodes.push(
        <ol key={key}>
          {items.map((item, itemIndex) => (
            <li key={`${key}-li-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      blockIndex += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      nodes.push(<hr key={key} />);
      index += 1;
      blockIndex += 1;
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    nodes.push(<p key={key}>{renderInline(paragraph.join(' '), key)}</p>);
    blockIndex += 1;
  }

  return nodes;
}

export function MarkdownDemo() {
  const [source, setSource] = useState(EXAMPLE);
  const preview = useMemo(() => parseMarkdown(source), [source]);
  const characterCount = source.replace(/\s/g, '').length;

  return (
    <section className="demo-workspace markdown-demo" aria-label="Markdown 安全解析原理演示">
      <div className="demo-toolbar">
        <div>
          <span className="demo-live-badge">纯文本解析</span>
          <h2>写作与预览，保持在同一屏</h2>
        </div>
        <div className="markdown-actions">
          <button
            type="button"
            className="button button--quiet button--small"
            onClick={() => setSource(EXAMPLE)}
          >
            <RotateCcw size={14} aria-hidden="true" />
            重置示例
          </button>
          <button
            type="button"
            className="button button--quiet button--small"
            onClick={() => setSource('')}
          >
            <Trash2 size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </div>

      <div className="markdown-layout">
        <div className="markdown-pane markdown-pane--editor">
          <div className="markdown-pane__head">
            <label htmlFor="markdown-source">Markdown 源文</label>
            <span>
              {characterCount} 个非空白字符 · 上限 {MAX_SOURCE_LENGTH} 字符
            </span>
          </div>
          <textarea
            id="markdown-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
            maxLength={MAX_SOURCE_LENGTH}
            placeholder="在这里输入 Markdown…"
          />
        </div>

        <div className="markdown-pane markdown-pane--preview">
          <div className="markdown-pane__head">
            <span>安全预览</span>
            <span>HTML 不执行</span>
          </div>
          <article className="markdown-preview" aria-label="Markdown 安全预览">
            {preview.length > 0 ? (
              preview
            ) : (
              <p className="markdown-preview__empty">左侧还没有内容。写点 Markdown，预览会立即出现。</p>
            )}
          </article>
        </div>
      </div>

      <div className="markdown-security">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          预览器不会使用 <code>dangerouslySetInnerHTML</code>，也不渲染原始 HTML。标签会按文字显示，链接只接受
          http/https 地址。这里只演示基础语法，不替代完整的 Markdown 规范。
        </p>
      </div>
    </section>
  );
}
