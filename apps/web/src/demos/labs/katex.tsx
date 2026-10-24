import { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, LabLayout, Segmented, Stage, Stats, Stat, Status, TextField } from '../lab-kit';

interface Preset {
  id: string;
  name: string;
  tex: string;
}

const PRESETS: Preset[] = [
  { id: 'frac', name: '分式与根号', tex: '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a} = \\sqrt[3]{\\frac{\\pi}{6}}' },
  { id: 'sum', name: '求和与积分', tex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}, \\qquad \\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}' },
  { id: 'matrix', name: '矩阵', tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}^{-1} = \\frac{1}{ad-bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}' },
  { id: 'cases', name: '分段函数', tex: 'f(x)=\\begin{cases} x^2, & x \\ge 0 \\\\ -x, & x < 0 \\end{cases}' },
  { id: 'align', name: '对齐环境', tex: '\\begin{aligned} \\nabla \\cdot \\vec{E} &= \\frac{\\rho}{\\varepsilon_0} \\\\ \\nabla \\times \\vec{B} &= \\mu_0 \\vec{J} + \\mu_0\\varepsilon_0 \\frac{\\partial \\vec{E}}{\\partial t} \\end{aligned}' },
  { id: 'broken', name: '故意写错（看报错）', tex: '\\frac{1}{2^{x} + \\sqrt{y' },
];

const DEFAULT_TEX = PRESETS[3].tex;

type Output = { html: string; ms: number; length: number } | null;

/**
 * KaTeX：真实排版 + 真实解析错误。
 * 先用 throwOnError:true 把错误信息抓出来，再用 throwOnError:false 输出可渲染的结果。
 */
export default function KatexLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [tex, setTex] = useState(DEFAULT_TEX);
  const [displayMode, setDisplayMode] = useState(true);

  const { html, error, output } = useMemo(() => {
    const source = tex.trim();
    if (source.length === 0) {
      return { html: '', error: '', output: null as Output };
    }
    // 1) 严格模式：把 KaTeX 真实的 ParseError 抛出来。
    try {
      katex.renderToString(source, { throwOnError: true, displayMode });
    } catch (err) {
      return { html: '', error: (err as Error).message, output: null as Output };
    }
    // 2) 宽松模式：产出 HTML。
    try {
      const t0 = performance.now();
      const rendered = katex.renderToString(source, { throwOnError: false, displayMode, output: 'html' });
      const ms = performance.now() - t0;
      return { html: rendered, error: '', output: { html: rendered, ms, length: rendered.length } };
    } catch (err) {
      return { html: '', error: (err as Error).message, output: null as Output };
    }
  }, [tex, displayMode]);

  const empty = tex.trim().length === 0;
  const tooLong = tex.length > 600;

  return (
    <Lab
      title="KaTeX 数学排版"
      badge={<span className="demo-live-badge">KaTeX {katex.version}</span>}
      reset={() => setTex(DEFAULT_TEX)}
    >
      <LabLayout
        layout="editor"
        controls={
          <>
            <p className="demo-caption">
              <code>renderToString</code> 先用 <code>throwOnError: true</code> 探测真实报错，再用 <code>throwOnError: false</code> 出图。
            </p>
            <Segmented<'on' | 'off'>
              label="displayMode"
              value={displayMode ? 'on' : 'off'}
              options={[
                ['on', 'displayMode: true（行间）'],
                ['off', 'displayMode: false（行内）'],
              ]}
              onChange={(v) => setDisplayMode(v === 'on')}
            />
            <TextField label="TeX 源码" value={tex} onChange={setTex} rows={5} mono />
            <div className="lab-katex__presets">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="lab-katex__btn" onClick={() => setTex(p.tex)}>
                  {p.name}
                </button>
              ))}
            </div>
          </>
        }
      >
        <Stage>
          <div className="lab-katex__out">
            {empty ? (
              <p className="lab-status">TeX 为空：请输入公式或点左侧预设。</p>
            ) : error ? (
              <ErrorNote>{error}</ErrorNote>
            ) : (
              // KaTeX 会把 TeX 转义后再输出 span/annotation，颜色全部来自本地 KaTeX，
              // 输入里的任何 < > 都不会变成真实标签。
              <div dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>
        </Stage>
      </LabLayout>

      <Stats>
        <Stat label="TeX 长度" value={tex.length} />
        <Stat label="renderToString 耗时" value={output ? `${output.ms.toFixed(2)} ms` : '—'} />
        <Stat label="输出 HTML 长度" value={output ? output.length : 0} />
      </Stats>
      {empty ? <Status tone="warn">当前没有公式。</Status> : null}
      {tooLong ? <Status tone="warn">公式超过 600 字符，排版可能溢出下方容器（已限制为横向滚动）。</Status> : null}
      {!empty && !error ? <Status tone="ok">解析通过：throwOnError:true 没有抛出异常。</Status> : null}

      <Code
        text={output ? `// throwOnError: true —— 通过\nkatex.renderToString(${JSON.stringify(tex.trim())}, { throwOnError: true, displayMode: ${displayMode} });\n\n// throwOnError: false —— 实测 ${output.ms.toFixed(2)} ms，产出 ${output.length} 字符 HTML\n${output.html.slice(0, 1200)}${output.html.length > 1200 ? '\n… 已截断' : ''}` : `// throwOnError: true —— 抛出\n${error || '（空输入）'}`}
        onCopy={onCopy}
        label="renderToString 真实调用与输出"
        maxHeight={280}
      />
    </Lab>
  );
}
