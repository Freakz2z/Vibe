import { useMemo, useState } from 'react';
import Color from 'colorjs.io';
import type { DemoCopyHandler } from '../types';
import {
  Code,
  DataTable,
  ErrorNote,
  Lab,
  LabLayout,
  Range,
  Segmented,
  Stat,
  Stats,
  Status,
  TextField,
} from '../lab-kit';

/* ------------------------------------------------------------------ */
/* Types & presets                                                     */
/* ------------------------------------------------------------------ */

type Method = 'css' | 'clip' | 'lch.c' | 'oklch.c';
type Space = 'srgb' | 'p3' | 'rec2020';

const METHODS: readonly (readonly [Method, string])[] = [
  ['css', 'css（CSS Color 4 算法）'],
  ['clip', 'clip（逐通道硬裁剪）'],
  ['lch.c', 'lch.c（降 CIELCH 色度）'],
  ['oklch.c', 'oklch.c（降 OKLCH 色度）'],
];

const SPACES: readonly (readonly [Space, string])[] = [
  ['srgb', 'sRGB'],
  ['p3', 'P3'],
  ['rec2020', 'Rec.2020'],
];

interface Mapping {
  space: Space;
  spaceLabel: string;
  method: Method;
  inGamut: boolean;
  clippedCoords: string;
  clippedHex: string;
  mappedHex: string;
  mappedCss: string;
  mappedStillInGamut: boolean;
  deltaE2000: number;
}

interface Probe {
  l: number;
  c: number;
  h: number;
  css: string;
  hexInSrgb: string;
}

interface A {
  css: string;
  hex: string;
}

interface Computation {
  probe: Probe;
  mapping: Mapping;
  pair: { a: A; b: A; deltaE2000: number; contrast: number; passesAA: boolean; passesAAA: boolean };
}

function buildProbe(l: number, c: number, h: number): Probe {
  const probe = new Color('oklch', [l, c, h]);
  return {
    l,
    c,
    h,
    css: probe.to('oklch').toString({ precision: 5 }),
    hexInSrgb: probe.to('srgb').toString({ format: 'hex' }),
  };
}

/** Everything here is a real colorjs.io call — no cached or faked values. */
function compute(l: number, c: number, h: number, space: Space, method: Method, aText: string, bText: string): Computation {
  const probe = new Color('oklch', [l, c, h]);
  const spaceLabel = SPACES.find(([id]) => id === space)?.[1] ?? space;

  const inGamut = probe.inGamut(space);
  const clipped = probe.to(space);
  const clippedHex = clipped.toString({ format: 'hex' });

  // NOTE: colorjs.io's toGamut mutates the colour it is called on and returns it,
  // so every mapping needs its own clone or all methods look identical.
  const mapped = probe.clone().toGamut({ method, space });
  const deltaE2000 = mapped.clone().deltaE2000(probe);
  const mappedHex = mapped.to(space).toString({ format: 'hex' });
  const mappedStillInGamut = mapped.inGamut(space);

  const a = new Color(aText);
  const b = new Color(bText);
  const contrast = a.contrastWCAG21(b);

  return {
    probe: buildProbe(l, c, h),
    mapping: {
      space,
      spaceLabel,
      method,
      inGamut,
      clippedCoords: `${clipped.coords.map((n) => n.toFixed(4)).join(' · ')}`,
      clippedHex,
      mappedHex,
      mappedCss: mapped.to(space).toString({ precision: 5 }),
      mappedStillInGamut,
      deltaE2000,
    },
    pair: {
      a: { css: a.to('oklch').toString({ precision: 5 }), hex: a.to('srgb').toString({ format: 'hex' }) },
      b: { css: b.to('oklch').toString({ precision: 5 }), hex: b.to('srgb').toString({ format: 'hex' }) },
      deltaE2000: a.clone().deltaE2000(b),
      contrast,
      passesAA: contrast >= 4.5,
      passesAAA: contrast >= 7,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

const EXAMPLES: readonly (readonly [string, string])[] = [
  ['#2d6a4f', '#ffd166'],
  ['#e2725b', '#1d3557'],
  ['#ffffff', '#767676'],
];

export default function ColorjsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [l, setL] = useState(0.85);
  const [c, setC] = useState(0.32);
  const [h, setH] = useState(28);
  const [space, setSpace] = useState<Space>('srgb');
  const [method, setMethod] = useState<Method>('css');
  const [aText, setAText] = useState('#2d6a4f');
  const [bText, setBText] = useState('#ffd166');

  const result = useMemo<
    { ok: true; data: Computation } | { ok: false; error: string }
  >(() => {
    try {
      return { ok: true, data: compute(l, c, h, space, method, aText, bText) };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      return { ok: false, error: raw };
    }
  }, [l, c, h, space, method, aText, bText]);

  const data = result.ok ? result.data : null;

  const snippet = useMemo(
    () =>
      [
        `import Color from 'colorjs.io';`,
        ``,
        `const probe = new Color('oklch', [${l}, ${c}, ${h}]);`,
        ``,
        `probe.inGamut('${space}');        // 真实色域判定`,
        `probe.to('${space}').coords;      // 真实坐标（可能越界）`,
        ``,
        `// toGamut 会就地修改并返回自身 —— 必须 clone()`,
        `const mapped = probe.clone().toGamut({ method: '${method}', space: '${space}' });`,
        `mapped.to('${space}').toString({ format: 'hex' });`,
        `mapped.clone().deltaE2000(probe); // 映射前后的感知差`,
        ``,
        `const a = new Color(${JSON.stringify(aText)});`,
        `const b = new Color(${JSON.stringify(bText)});`,
        `a.clone().deltaE2000(b);`,
        `a.contrastWCAG21(b);`,
      ].join('\n'),
    [l, c, h, space, method, aText, bText],
  );

  const reset = () => {
    setL(0.85);
    setC(0.32);
    setH(28);
    setSpace('srgb');
    setMethod('css');
    setAText('#2d6a4f');
    setBText('#ffd166');
  };

  return (
    <Lab
      title="colorjs.io 色域映射与 ΔE2000"
      badge={<span className="demo-live-badge">colorjs.io 0.5.2</span>}
      reset={reset}
    >
      <LabLayout
        controls={
          <>
            <Range
              label="OKLCH 亮度 L"
              value={l}
              min={0}
              max={1}
              step={0.01}
              onChange={setL}
              hint="把 L 推到接近 0 或 1 时必然超出色域。"
            />
            <Range
              label="OKLCH 色度 C"
              value={c}
              min={0}
              max={0.4}
              step={0.01}
              onChange={setC}
              hint="C 越大越容易跑到 sRGB 之外。"
            />
            <Range label="OKLCH 色相 H" value={h} min={0} max={360} step={1} unit="°" onChange={setH} />
            <Segmented<Space> label="目标色域" value={space} options={SPACES} onChange={setSpace} />
            <SelectMethod value={method} onChange={setMethod} />
            <Status>色域、色差、对比度全部由 colorjs.io 计算；下面不做任何缓存。</Status>
          </>
        }
      >
        {!result.ok ? (
          <ErrorNote onRetry={reset}>{result.error}</ErrorNote>
        ) : (
          <div>
            <div className="lab-colorjs-row">
              <figure className="lab-colorjs-card">
                <span className="lab-colorjs-swatch" style={{ background: result.data.probe.hexInSrgb }} />
                <figcaption>
                  <strong>原始颜色</strong>
                  <code>{result.data.probe.css}</code>
                  <small>显示为 {result.data.probe.hexInSrgb}（浏览器把越界通道夹到 0–1）</small>
                </figcaption>
              </figure>
              <figure className="lab-colorjs-card">
                <span className="lab-colorjs-swatch" style={{ background: result.data.mapping.mappedHex }} />
                <figcaption>
                  <strong>映射结果（{result.data.mapping.method}）</strong>
                  <code>{result.data.mapping.mappedCss}</code>
                  <small>ΔE2000 偏移 {result.data.mapping.deltaE2000.toFixed(2)}</small>
                </figcaption>
              </figure>
            </div>

            <Stats>
              <Stat
                label={`在 ${result.data.mapping.spaceLabel} 内`}
                value={result.data.mapping.inGamut ? '是' : '否'}
              />
              <Stat label="映射后 ΔE2000" value={result.data.mapping.deltaE2000.toFixed(2)} />
              <Stat
                label="映射后仍在色域内"
                value={result.data.mapping.mappedStillInGamut ? '是' : '否'}
              />
            </Stats>

            <p className="lab-colorjs-note">
              <code>inGamut('{result.data.mapping.space}')</code> 返回 <strong>{String(result.data.mapping.inGamut)}</strong>；
              越界坐标为 <code>{result.data.mapping.clippedCoords}</code>。
              用 <code>method: '{result.data.mapping.method}'</code> 映射到 {result.data.mapping.spaceLabel} 后得到{' '}
              <code>{result.data.mapping.mappedHex}</code>。
            </p>
          </div>
        )}
      </LabLayout>

      {data ? (
        <div className="lab-editor-grid lab-editor-grid--tight">
          <div className="lab-editor-panel">
            <TextField label="颜色 A" value={aText} onChange={setAText} placeholder="#2d6a4f 或 oklch(0.6 0.2 140)" mono />
            <TextField label="颜色 B" value={bText} onChange={setBText} placeholder="#ffd166" mono />
            <div className="lab-options">
              {EXAMPLES.map(([a, b]) => (
                <button
                  key={a + b}
                  type="button"
                  className="lab-colorjs-preset"
                  onClick={() => {
                    setAText(a);
                    setBText(b);
                  }}
                >
                  <i className="lab-culori-dot" style={{ background: `linear-gradient(90deg, ${a}, ${b})` }} />
                  {a} / {b}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Stats>
              <Stat label="ΔE2000（A ↔ B）" value={data.pair.deltaE2000.toFixed(2)} />
              <Stat label="WCAG 2.1 对比度" value={`${data.pair.contrast.toFixed(2)}:1`} />
              <Stat
                label="对比度等级"
                value={data.pair.passesAAA ? 'AAA' : data.pair.passesAA ? 'AA' : '不达标'}
              />
            </Stats>
            <ul className="lab-checks" style={{ marginTop: 14 }}>
              <li data-pass={data.pair.passesAA}>
                AA 正文（≥ 4.5:1）：{data.pair.contrast >= 4.5 ? '通过' : '不通过'}
              </li>
              <li data-pass={data.pair.passesAAA}>
                AAA 正文（≥ 7:1）：{data.pair.contrast >= 7 ? '通过' : '不通过'}
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      {data ? (
        <div style={{ marginTop: 22 }}>
          <DataTable
            head={['项', '值']}
            caption="colorjs.io 本次调用的原始返回值"
            rows={[
              ['probe CSS', <code key="p">{data.probe.css}</code>],
              [`to('${data.mapping.space}').coords`, <code key="c">{data.mapping.clippedCoords}</code>],
              [`inGamut('${data.mapping.space}')`, <code key="g">{String(data.mapping.inGamut)}</code>],
              [`toGamut({ method: '${data.mapping.method}' })`, <code key="m">{data.mapping.mappedCss}</code>],
              ['映射后 hex', <code key="h">{data.mapping.mappedHex}</code>],
              ['deltaE2000(映射前 → 映射后)', <code key="d">{data.mapping.deltaE2000.toFixed(4)}</code>],
              ['颜色 A (oklch)', <code key="a">{data.pair.a.css}</code>],
              ['颜色 B (oklch)', <code key="b">{data.pair.b.css}</code>],
              ['contrastWCAG21(A, B)', <code key="w">{data.pair.contrast.toFixed(4)}</code>],
            ]}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <Code text={snippet} onCopy={onCopy} label="colorjs.io 调用" maxHeight={360} />
      </div>
    </Lab>
  );
}

function SelectMethod({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  return (
    <div className="lab-field">
      <span>映射算法 method</span>
      <div className="segmented" role="group" aria-label="映射算法">
        {METHODS.map(([m]) => (
          <button key={m} type="button" className={m === value ? 'is-active' : ''} aria-pressed={m === value} onClick={() => onChange(m)}>
            {m}
          </button>
        ))}
      </div>
      <small>{METHODS.find(([m]) => m === value)?.[1]}</small>
    </div>
  );
}
