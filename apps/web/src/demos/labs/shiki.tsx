import { LabControls } from '../lab-kit';
import { useEffect, useMemo, useState } from 'react';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import githubDark from 'shiki/themes/github-dark.mjs';
import githubLight from 'shiki/themes/github-light.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import python from 'shiki/langs/python.mjs';
import json from 'shiki/langs/json.mjs';
import markdown from 'shiki/langs/markdown.mjs';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, LabLayout, Segmented, Status, TextField, useThemeColors } from '../lab-kit';

type Lang = 'javascript' | 'typescript' | 'python' | 'json' | 'markdown';
type ThemeChoice = 'auto' | 'github-light' | 'github-dark';

const LANGS = {
  javascript: { label: 'JavaScript', source: javascript },
  typescript: { label: 'TypeScript', source: typescript },
  python: { label: 'Python', source: python },
  json: { label: 'JSON', source: json },
  markdown: { label: 'Markdown', source: markdown },
} as const;

const SAMPLE: Record<Lang, string> = {
  javascript: `import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

const engine = createJavaScriptRegexEngine();
const hl = await createHighlighterCore({
  themes: [githubLight, githubDark],
  langs: [javascript],
  engine,
});

const html = hl.codeToHtml(source, { lang: 'javascript', theme: 'github-dark' });
hl.dispose();`,
  typescript: `type Delta = { ops: ReadonlyArray<{ insert: string; attributes?: Record<string, boolean> }> };

export function compose(a: Delta, b: Delta): Delta {
  const out: Delta['ops'][number][] = [];
  for (const op of [...a.ops, ...b.ops]) out.push(op);
  return { ops: out };
}`,
  python: `from dataclasses import dataclass

@dataclass(frozen=True)
class Token:
    kind: str
    text: str

def tokenize(source: str) -> list[Token]:
    return [Token("word", w) for w in source.split() if w]`,
  json: `{
  "name": "vibe",
  "private": true,
  "dependencies": { "shiki": "1.24.4" },
  "scripts": { "build": "tsc -b && vite build" }
}`,
  markdown: `# 标题

- 列表 **加粗**
- [x] 任务

> 引用

[链接](https://shiki.style)
`,
};

/** 依据站点 --ink 的亮度判断当前是浅色还是深色主题。 */
function isDarkInk(hex: string | undefined): boolean {
  if (!hex) return false;
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (full.length < 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

/**
 * Shiki 1.24：JavaScript RegExp 引擎（零 WASM）下的语法高亮。
 * 计时与 token 计数都是本次渲染真实测出来的，不是写死的数字。
 */
export default function ShikiLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const [lang, setLang] = useState<Lang>('javascript');
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('auto');
  const [code, setCode] = useState(SAMPLE.javascript);

  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const [bootError, setBootError] = useState('');
  const [result, setResult] = useState({ html: '', ms: 0, spans: 0, lines: 0, theme: '', lang: '' });
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let instance: HighlighterCore | null = null;
    setBootError('');
    setHighlighter(null);

    // 纯 JS RegExp 引擎：不加载 oniguruma 的 WASM。
    const engine = createJavaScriptRegexEngine();
    createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: [javascript, typescript, python, json, markdown],
      engine,
    })
      .then((hl) => {
        if (cancelled) {
          hl.dispose();
          return;
        }
        instance = hl;
        setHighlighter(hl);
      })
      .catch((err: unknown) => {
        if (!cancelled) setBootError(`Shiki 初始化失败：${(err as Error).message}`);
      });

    return () => {
      cancelled = true;
      instance?.dispose();
      setHighlighter(null);
    };
  }, []);

  const siteIsDark = isDarkInk(colors.ink);
  const theme = themeChoice === 'auto' ? (siteIsDark ? 'github-dark' : 'github-light') : themeChoice;

  useEffect(() => {
    if (!highlighter) return;
    try {
      const t0 = performance.now();
      const html = highlighter.codeToHtml(code, { lang, theme });
      const ms = performance.now() - t0;
      setResult({
        html,
        ms,
        spans: (html.match(/<span/g) ?? []).length,
        lines: code.split('\n').length,
        theme,
        lang,
      });
      setRenderError('');
    } catch (err) {
      setRenderError(`codeToHtml 失败：${(err as Error).message}`);
      setResult({ html: '', ms: 0, spans: 0, lines: 0, theme, lang });
    }
  }, [highlighter, code, lang, theme]);

  const info = useMemo(() => {
    if (!highlighter) return '尚未加载';
    return `${highlighter.getLoadedThemes().join(', ')} ｜ ${highlighter.getLoadedLanguages().join(', ')}`;
  }, [highlighter]);

  const snippet = `const engine = createJavaScriptRegexEngine();   // 纯 JS RegExp，无 WASM
const highlighter = await createHighlighterCore({
  themes: [githubLight, githubDark],
  langs: [javascript, typescript, python, json, markdown],
  engine,
});
const html = highlighter.codeToHtml(code, { lang: '${lang}', theme: '${theme}' });
highlighter.dispose();`;

  return (
    <Lab title="Shiki 语法高亮（JS 正则引擎）" badge={<span className="demo-live-badge">Shiki 1.24</span>} reset={() => setCode(SAMPLE[lang])}>
      <LabControls className="lab-config lab-config--pair">
        <p className="demo-caption">
          用 <code>createHighlighterCore</code> + <code>createJavaScriptRegexEngine()</code>，全程不加载 WASM。
        </p>
        <Segmented<Lang>
          label="语言"
          value={lang}
          options={(Object.keys(LANGS) as Lang[]).map((k) => [k, LANGS[k].label] as const)}
          onChange={(v) => {
            setLang(v);
            setCode(SAMPLE[v]);
          }}
        />
        <Segmented<ThemeChoice>
          label="主题"
          value={themeChoice}
          options={[
            ['auto', '跟随站点'],
            ['github-light', 'github-light'],
            ['github-dark', 'github-dark'],
          ]}
          onChange={setThemeChoice}
        />
      </LabControls>
      <LabLayout
        layout="editor"
        controls={
          <>
            <TextField label="代码" value={code} onChange={setCode} rows={12} mono />
            <p className="lab-field__rule">已加载：{info}</p>
          </>
        }
      >
        {bootError ? (
          <ErrorNote>{bootError}</ErrorNote>
        ) : !highlighter ? (
          <p className="lab-status">正在用 JavaScript RegExp 引擎初始化高亮器…</p>
        ) : renderError ? (
          <ErrorNote>{renderError}</ErrorNote>
        ) : result.html ? (
          // Shiki 会转义代码文本，颜色全部来自本地打包的主题文件，
          // 输出里没有任何来自输入的原始 HTML 片段。
          <div className="lab-shiki__out" dangerouslySetInnerHTML={{ __html: result.html }} />
        ) : (
          <p className="lab-status">没有可渲染的内容。</p>
        )}
      </LabLayout>

      <div className="lab-shiki__stats">
        <Status tone="ok">
          本次 codeToHtml 实测 {result.ms.toFixed(2)} ms（浏览器 performance.now，仅覆盖高亮与序列化，不含 React 渲染）
        </Status>
        <Status>
          theme={result.theme} · lang={result.lang} · {result.lines} 行 · {result.spans} 个 token span
        </Status>
        {result.lines === 0 ? <Status tone="warn">代码为空，Shiki 只输出了空文档。</Status> : null}
        {code.length > 8000 ? <Status tone="warn">代码超过 8000 字符，高亮仍在进行，但统计口径以这次实际渲染为准。</Status> : null}
      </div>

      <Code text={snippet} onCopy={onCopy} label="真实调用" />
    </Lab>
  );
}
