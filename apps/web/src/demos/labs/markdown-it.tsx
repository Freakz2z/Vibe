import { Fragment, useMemo, useState, type ReactNode } from 'react';
import markdownit from 'markdown-it';
import type { Token } from 'markdown-it';
import type { DemoCopyHandler } from '../types';
import { Code, DataTable, Lab, LabLayout, Stats, Stat, Status, TextField } from '../lab-kit';

const SAMPLE = `# Markdown-it 安全渲染

**粗体**、*斜体*、~~删除线~~ 与 \`行内代码\`。

## 为什么不用 innerHTML

下面这行源码里有 \`<script>alert(1)</script>\` 与一个 <img onerror="alert(1)"> 标签。
因为 \`html: false\`，它们会被当作普通文本转义，**不会**变成真实节点。

> 引用块里同样可以放 [外部链接](https://commonmark.org)，链接地址会被白名单校验。

1. 有序列表
2. 第二项
   - 嵌套无序项

\`\`\`js
const html = md.render(src); // 只作为文本展示，从不 innerHTML
\`\`\`

裸链接会被 linkify 自动识别：https://spec.commonmark.org
`;

const DANGEROUS = `直接写 <script>alert('xss')</script> 和 <img src=x onerror="alert(1)">，还有 [点我](javascript:alert(1))。
`;

type OptionKey = 'typographer' | 'breaks' | 'linkify' | 'html';

interface Options {
  html: boolean;
  linkify: boolean;
  typographer: boolean;
  breaks: boolean;
}

const OPTION_LABEL: Record<OptionKey, string> = {
  html: 'html: false（关掉原始 HTML）',
  linkify: 'linkify',
  typographer: 'typographer',
  breaks: 'breaks',
};

const OPTION_HINT: Record<OptionKey, string> = {
  html: '开启后 markdown-it 会原样输出 <script>，本示例仅用于对比，切回 false 即可看到转义。',
  linkify: '把裸 URL 自动转成链接（地址仍会经过白名单）。',
  typographer: '把引号、破折号、乘号等替换为排版字符。',
  breaks: '段落内换行渲染成 <br>。',
};

function attr(token: Token, name: string): string {
  const found = token.attrs?.find(([k]) => k === name);
  return found ? String(found[1]) : '';
}

/** 只放行 http/https/mailto/站内相对地址；javascript:、data: 等一律降级为纯文本。 */
function safeHref(href: string): string | null {
  const value = href.trim();
  if (!value) return null;
  if (/^(https?:|mailto:)/i.test(value)) return value;
  if (/^[#/.]/.test(value) && !/^\/\//.test(value)) return value;
  return null;
}

/** 按 markdown-it 的 token 流手写一个安全的 React 渲染器：没有任何 innerHTML。 */
function inlineNodes(children: Token[] | null): ReactNode[] {
  if (!children) return [];
  const out: ReactNode[] = [];
  let i = 0;
  while (i < children.length) {
    const t = children[i];
    switch (t.type) {
      case 'text':
      case 'text_special':
      case 'html_inline':
        out.push(<Fragment key={i}>{t.content}</Fragment>);
        i += 1;
        break;
      case 'code_inline':
        out.push(
          <code key={i} className="lab-md__code">
            {t.content}
          </code>,
        );
        i += 1;
        break;
      case 'softbreak':
        out.push(<Fragment key={i}> </Fragment>);
        i += 1;
        break;
      case 'hardbreak':
        out.push(<br key={i} />);
        i += 1;
        break;
      case 'image': {
        // 不发起任何外部请求：只展示 alt 与被拦下的 src。
        const alt = t.content || attr(t, 'alt') || '（无 alt）';
        const src = attr(t, 'src');
        out.push(
          <span key={i} className="lab-md__img" title={`未加载的 src：${src}`}>
            🖼 {alt}（已拦截 src，不发网络请求）
          </span>,
        );
        i += 1;
        break;
      }
      case 'strong_open':
      case 'em_open':
      case 's_open': {
        const tag = t.type.replace('_open', '');
        const closeIdx = children[i + 1]?.type === `${tag}_close` ? i + 2 : i + 1;
        const inner = inlineNodes(children.slice(i + 1, Math.max(i + 1, closeIdx - 1)));
        out.push(
          tag === 'strong' ? <strong key={i}>{inner}</strong> : tag === 'em' ? <em key={i}>{inner}</em> : <s key={i}>{inner}</s>,
        );
        i = closeIdx;
        break;
      }
      case 'link_open': {
        const href = safeHref(attr(t, 'href'));
        const closeIdx = children[i + 1]?.type === 'link_close' ? i + 2 : i + 1;
        const inner = inlineNodes(children.slice(i + 1, Math.max(i + 1, closeIdx - 1)));
        out.push(
          href ? (
            <a key={i} href={href} target="_blank" rel="noreferrer noopener">
              {inner}
            </a>
          ) : (
            <span key={i} title="该地址不在白名单内，已降级为纯文本">
              {inner}
            </span>
          ),
        );
        i = closeIdx;
        break;
      }
      default:
        out.push(<Fragment key={i}>{t.content}</Fragment>);
        i += 1;
    }
  }
  return out;
}

function findClose(tokens: Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i += 1) {
    depth += tokens[i].nesting;
    if (depth === 0) return i;
  }
  return tokens.length - 1;
}

function blockNodes(tokens: Token[], prefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    switch (t.type) {
      case 'paragraph_open': {
        const inner = tokens[i + 1];
        out.push(<p key={`${prefix}-${i}`}>{inner?.type === 'inline' ? inlineNodes(inner.children) : null}</p>);
        i += 3;
        break;
      }
      case 'heading_open': {
        const inner = tokens[i + 1];
        const level = Number(t.tag.slice(1)) || 2;
        const body = inner?.type === 'inline' ? inlineNodes(inner.children) : null;
        // 标题统一降级到 h2–h4，避免用户 markdown 撑破页面层级
        const Tag = (level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
        out.push(
          <Tag key={`${prefix}-${i}`}>
            {body}
            <span className="lab-md__level">h{t.tag.slice(1)}</span>
          </Tag>,
        );
        i += 3;
        break;
      }
      case 'blockquote_open': {
        const close = findClose(tokens, i);
        out.push(<blockquote key={`${prefix}-${i}`}>{blockNodes(tokens.slice(i + 1, close), `${prefix}-${i}`)}</blockquote>);
        i = close + 1;
        break;
      }
      case 'bullet_list_open':
      case 'ordered_list_open': {
        const close = findClose(tokens, i);
        const items = tokens.slice(i + 1, close);
        const startAttr = Number(attr(t, 'start') ?? '1');
        out.push(
          t.type === 'ordered_list_open' ? (
            <ol key={`${prefix}-${i}`} start={Number.isFinite(startAttr) ? startAttr : 1}>
              {blockNodes(items, `${prefix}-${i}`)}
            </ol>
          ) : (
            <ul key={`${prefix}-${i}`}>{blockNodes(items, `${prefix}-${i}`)}</ul>
          ),
        );
        i = close + 1;
        break;
      }
      case 'list_item_open': {
        const close = findClose(tokens, i);
        out.push(<li key={`${prefix}-${i}`}>{blockNodes(tokens.slice(i + 1, close), `${prefix}-${i}`)}</li>);
        i = close + 1;
        break;
      }
      case 'fence':
      case 'code_block':
        out.push(
          <pre key={`${prefix}-${i}`} className="lab-md__pre">
            <code data-lang={t.info}>{t.content}</code>
          </pre>,
        );
        i += 1;
        break;
      case 'html_block':
        // html:false 时几乎不会出现；真出现了也只当纯文本展示。
        out.push(
          <pre key={`${prefix}-${i}`} className="lab-md__escaped">
            {t.content}
          </pre>,
        );
        i += 1;
        break;
      case 'hr':
        out.push(<hr key={`${prefix}-${i}`} />);
        i += 1;
        break;
      case 'inline':
        out.push(<p key={`${prefix}-${i}`}>{inlineNodes(t.children)}</p>);
        i += 1;
        break;
      default:
        i += 1;
    }
  }
  return out;
}

function truncate(text: string, limit = 4000): string {
  return text.length > limit ? `${text.slice(0, limit)}\n… 已截断（共 ${text.length} 字符）` : text;
}

/**
 * markdown-it v15：真实解析器 + 手动 token→React 渲染。
 * 全程不写 innerHTML：md.render() / renderInline() 的结果只作为文本展示，用于证明转义。
 */
export default function MarkdownItLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [source, setSource] = useState(SAMPLE);
  const [danger, setDanger] = useState(DANGEROUS);
  const [options, setOptions] = useState<Options>({ html: false, linkify: true, typographer: true, breaks: true });

  const md = useMemo(
    () =>
      markdownit({
        html: options.html,
        linkify: options.linkify,
        typographer: options.typographer,
        breaks: options.breaks,
      }),
    [options],
  );

  const tokens = useMemo(() => {
    try {
      return md.parse(source, {});
    } catch (err) {
      return [] as Token[];
    }
  }, [md, source]);

  const inlineTokens = useMemo(() => {
    try {
      return md.parseInline(danger, {});
    } catch {
      return [] as Token[];
    }
  }, [md, danger]);

  const rawHtml = useMemo(() => {
    try {
      return md.render(source);
    } catch (err) {
      return `md.render 抛出异常：${(err as Error).message}`;
    }
  }, [md, source]);

  const rawInline = useMemo(() => {
    try {
      return md.renderInline(danger);
    } catch (err) {
      return `md.renderInline 抛出异常：${(err as Error).message}`;
    }
  }, [md, danger]);

  const escaped = /&lt;script|&lt;img|onerror/i.test(rawHtml) && /&lt;script|&lt;img|onerror/i.test(rawInline);
  const unsafeHrefDropped = rawInline.includes('javascript:') && !/<a href="javascript:/i.test(rawInline);
  const empty = source.trim().length === 0;
  const tooLong = source.length > 5000;

  const tokenRows = useMemo(
    () =>
      tokens.slice(0, 40).map((t, i) => [
        String(i),
        t.type,
        t.tag || '—',
        t.nesting === 1 ? '开' : t.nesting === -1 ? '闭' : '自闭',
        t.content.replace(/\s+/g, ' ').slice(0, 46) || (t.info ? `info=${t.info}` : '—'),
      ]),
    [tokens],
  );

  const inlineRows = useMemo(
    () =>
      inlineTokens.slice(0, 20).map((t, i) => [
        String(i),
        t.type,
        attr(t, 'href') || '—',
        t.content.replace(/\s+/g, ' ').slice(0, 40) || '—',
      ]),
    [inlineTokens],
  );

  return (
    <Lab title="markdown-it 解析与安全渲染" badge={<span className="demo-live-badge">markdown-it 15</span>} reset={() => { setSource(SAMPLE); setDanger(DANGEROUS); setOptions({ html: false, linkify: true, typographer: true, breaks: true }); }}>
      <LabLayout
        layout="editor"
        controls={
          <>
            <p className="demo-caption">
              <code>md.parse()</code> 出来的 token 流由本页自己渲染成 React 元素，<b>全程没有 innerHTML</b>。
            </p>
            <TextField label="Markdown 源码" value={source} onChange={setSource} rows={10} mono />
          </>
        }
      >
        <div className="lab-md__preview">
          {empty ? (
            <p className="lab-status">输入为空：md.parse() 返回空数组，预览区显示占位提示。</p>
          ) : (
            blockNodes(tokens, 'md')
          )}
        </div>
      </LabLayout>
      <div className="lab-config lab-config--options">
        {(Object.keys(OPTION_LABEL) as OptionKey[]).map((key) => (
          <div key={key} className="lab-field">
            <span>{OPTION_LABEL[key]}</span>
            <label className="lab-option">
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(e) => setOptions((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
              {options[key] ? '已开启' : '已关闭'}
            </label>
            <small className="lab-field__rule">{OPTION_HINT[key]}</small>
          </div>
        ))}
      </div>

      <Stats>
        <Stat label="block token 数" value={tokens.length} />
        <Stat label="inline token 数" value={inlineTokens.length} />
        <Stat label="源码长度" value={source.length} />
      </Stats>
      {tooLong ? <Status tone="warn">源码超过 5000 字符，预览仍实时渲染，但下方 JSON 会被截断以免页面过长。</Status> : null}
      {empty ? <Status tone="warn">当前没有内容可渲染。</Status> : null}

      <div className="lab-md__proof">
        <h3>转义与净化证明</h3>
        <ul>
          <li data-pass={escaped}>
            恶意样本经过 <code>md.render()</code> / <code>md.renderInline()</code> 后，<code>&lt;script&gt;</code> 与
            <code>onerror</code> 都以实体形式出现，没有变成真实标签。
          </li>
          <li data-pass={unsafeHrefDropped}>
            <code>javascript:</code> 协议的链接在预览里被降级为纯文本。
          </li>
          <li data-pass>图片只显示 alt，不加载远端 src（本站不做外部请求）。</li>
        </ul>
      </div>

      <TextField label="恶意样本（用于证明转义）" value={danger} onChange={setDanger} rows={3} mono />

      <div className="lab-editor-grid lab-editor-grid--tight">
        <Code text={truncate(rawHtml)} onCopy={onCopy} label="md.render() —— 仅作文本展示" maxHeight={280} />
        <Code text={truncate(rawInline, 1600)} onCopy={onCopy} label="md.renderInline() —— 仅作文本展示" maxHeight={280} />
      </div>

      <DataTable
        head={['#', 'type', 'href', 'content']}
        rows={inlineRows}
        caption="md.parseInline(恶意样本).tokens —— 原始 HTML 已经被转义进 text token"
      />

      <DataTable head={['#', 'token.type', 'tag', 'nesting', 'content']} rows={tokenRows} caption={`md.parse(源码).tokens（前 ${Math.min(tokens.length, 40)} 个）`} />
    </Lab>
  );
}
