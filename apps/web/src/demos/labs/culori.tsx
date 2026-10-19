import { useMemo, useState } from 'react';
import {
  converter,
  differenceCiede2000,
  differenceEuclidean,
  filterInvert,
  fixupHueDecreasing,
  fixupHueIncreasing,
  fixupHueLonger,
  fixupHueShorter,
  formatCss,
  formatHex,
  interpolate,
  parse,
  wcagContrast,
  type Color,
} from 'culori';
import type { DemoCopyHandler } from '../types';
import {
  Code,
  DataTable,
  ErrorNote,
  Lab,
  LabLayout,
  Range,
  Select,
  Stat,
  Stats,
  Status,
} from '../lab-kit';

/* ------------------------------------------------------------------ */
/* Types & presets                                                     */
/* ------------------------------------------------------------------ */

type Space = 'rgb' | 'hsl' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'p3';
type Fixup = 'none' | 'shorter' | 'longer' | 'increasing' | 'decreasing';

const SPACES: readonly (readonly [Space, string])[] = [
  ['rgb', 'sRGB（设备相关）'],
  ['hsl', 'HSL（直觉但不公平）'],
  ['lab', 'CIELAB（经典感知）'],
  ['lch', 'CIELCH（极坐标 Lab）'],
  ['oklab', 'OKLab（现代感知）'],
  ['oklch', 'OKLCH（现代 CSS）'],
  ['p3', 'Display-P3（广色域）'],
];

const FIXUPS: readonly (readonly [Fixup, string])[] = [
  ['none', 'Culori 默认'],
  ['shorter', 'fixupHueShorter（最短弧）'],
  ['longer', 'fixupHueLonger（最长弧）'],
  ['increasing', 'fixupHueIncreasing（递增）'],
  ['decreasing', 'fixupHueDecreasing（递减）'],
];

const FIXUP_FN: Record<Exclude<Fixup, 'none'>, typeof fixupHueShorter> = {
  shorter: fixupHueShorter,
  longer: fixupHueLonger,
  increasing: fixupHueIncreasing,
  decreasing: fixupHueDecreasing,
};

/** Hue lives on `h` for HSL/LCH/OKLCH, on `l` is lightness — never override both. */
const HUE_CHANNEL: Partial<Record<Space, string>> = { hsl: 'h', lch: 'h', oklch: 'h' };

const PAIRS: readonly (readonly [string, string, string])[] = [
  ['#e2725b', '#2d6a4f', '互补色（暖 ↔ 冷）'],
  ['#ff0000', '#0000ff', 'sRGB 原色（会经过灰色）'],
  ['#ffd166', '#ef476f', '明黄 ↔ 洋红'],
  ['#1d3557', '#f1faee', '深蓝 ↔ 近白'],
];

interface Row {
  space: string;
  name: string;
  from: string;
  mid: string;
  to: string;
  midHex: string;
}

interface Computation {
  from: Color;
  to: Color;
  mid: Color;
  stops: string[];
  gradient: string;
  deltaLab: number;
  deltaE2000: number;
  contrast: number;
  rows: Row[];
  inverse: boolean;
  space: Space;
}

/* ------------------------------------------------------------------ */
/* Real Culori work                                                    */
/* ------------------------------------------------------------------ */

/** Every value below is produced by Culori itself; nothing here is precomputed. */
function compute(
  fromText: string,
  toText: string,
  space: Space,
  fixup: Fixup,
  steps: number,
  shift: number,
  invert: boolean,
): Computation {
  const rawFrom = parse(fromText.trim());
  if (!rawFrom) {
    throw new Error(`culori 的 parse() 无法识别起始色 “${fromText}”。请使用 #rgb / #rrggbb、lch(...)、oklch(...) 或命名色。`);
  }
  const rawTo = parse(toText.trim());
  if (!rawTo) {
    throw new Error(`culori 的 parse() 无法识别目标色 “${toText}”。请使用 #rgb / #rrggbb、lch(...)、oklch(...) 或命名色。`);
  }

  // filterInvert(amount, mode) is a *factory* in Culori v4 — it returns a mapper.
  const invertFn = invert ? filterInvert(1, 'rgb') : (c: Color) => c;
  const from = invertFn(rawFrom);
  const to = invertFn(rawTo);
  if (!from || !to) throw new Error('Culori 在反相时返回了 undefined，原始输入不是有效颜色。');

  // Apply the perceptual lightness shift in OKLCH — the space where L is uniform.
  const toOklch = converter('oklch');
  const shiftLn = (c: Color): Color => {
    if (shift === 0) return c;
    const o = toOklch(c);
    if (!o) throw new Error(`Culori 无法把 ${formatHex(c)} 转到 oklch。`);
    o.l = Math.max(0, Math.min(1, (o.l ?? 0) + shift / 100));
    return o;
  };
  const a = shiftLn(from);
  const b = shiftLn(to);

  const hueChannel = HUE_CHANNEL[space];
  const overrides =
    fixup === 'none' || !hueChannel ? undefined : { [hueChannel]: { fixup: FIXUP_FN[fixup] } };

  const ramp = interpolate([a, b], space, overrides);

  const count = Math.max(2, Math.min(64, steps));
  const stops: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    stops.push(formatHex(ramp(t)));
  }

  const mid = ramp(0.5);
  const gradient = `linear-gradient(90deg, ${stops
    .map((hex, i) => `${hex} ${((i / (count - 1)) * 100).toFixed(2)}%`)
    .join(', ')})`;

  // v4: differenceEuclidean('lab') returns the comparator, not the number.
  const deltaLab = differenceEuclidean('lab')(a, b);
  const deltaE2000 = differenceCiede2000()(a, b);
  const contrast = wcagContrast(a, b);

  const rows: Row[] = (['rgb', 'lab', 'lch', 'oklab', 'oklch', 'p3'] as const).map((mode) => ({
    space: mode,
    name: SPACES.find(([s]) => s === mode)?.[1] ?? mode,
    from: formatCss(converter(mode)(a) as Color),
    mid: formatCss(converter(mode)(mid) as Color),
    to: formatCss(converter(mode)(b) as Color),
    midHex: formatHex(converter(mode)(mid) as Color),
  }));

  return { from: a, to: b, mid, stops, gradient, deltaLab, deltaE2000, contrast, rows,
    inverse: invert,
    space,
  };
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

export default function CuloriLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const [from, setFrom] = useState('#e2725b');
  const [to, setTo] = useState('#2d6a4f');
  const [space, setSpace] = useState<Space>('lch');
  const [fixup, setFixup] = useState<Fixup>('none');
  const [steps, setSteps] = useState(12);
  const [shift, setShift] = useState(0);
  const [invert, setInvert] = useState(false);

  const result = useMemo<{ ok: true; data: Computation } | { ok: false; error: string }>(() => {
    try {
      return { ok: true, data: compute(from, to, space, fixup, steps, shift, invert) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [from, to, space, fixup, steps, shift, invert]);

  const data = result.ok ? result.data : null;

  const rampSnippet = useMemo(() => {
    const hueChannel = HUE_CHANNEL[space];
    if (fixup === 'none' || !hueChannel) {
      return `const ramp = interpolate([a, b], '${space}');`;
    }
    return [
      `const ramp = interpolate([a, b], '${space}', {`,
      `  ${hueChannel}: { fixup: ${FIXUP_FN[fixup].name} },`,
      `});`,
    ].join('\n');
  }, [space, fixup]);

  const snippet = useMemo(
    () =>
      [
        `import { converter, interpolate, formatHex, formatCss, differenceEuclidean } from 'culori';`,
        ``,
        `const a = parse(${JSON.stringify(from)});`,
        `const b = parse(${JSON.stringify(to)});`,
        ``,
        `// v4 签名：先拿到插值器，再按 t 取色`,
        rampSnippet,
        ``,
        `const stops = Array.from({ length: ${steps} }, (_, i) =>`,
        `  formatHex(ramp(${steps > 1 ? `i / ${steps - 1}` : '0'})));`,
        ``,
        `// 感知色差：v4 返回的是比较函数，不是数值`,
        `const dLab = differenceEuclidean('lab')(a, b);`,
        `const dE2000 = differenceCiede2000()(a, b);`,
        `const contrast = wcagContrast(a, b);`,
      ].join('\n'),
    [from, to, steps, rampSnippet],
  );

  const reset = () => {
    setFrom('#e2725b');
    setTo('#2d6a4f');
    setSpace('lch');
    setFixup('none');
    setSteps(12);
    setShift(0);
    setInvert(false);
  };

  return (
    <Lab title="Culori 跨色彩空间插值" badge={<span className="demo-live-badge">culori 4.0.1</span>} reset={reset}>
      <LabLayout
        controls={
          <>
            <div className="lab-field">
              <span>起始色 / 目标色</span>
              <div className="lab-culori-inputs">
                {(
                  [
                    ['起始色', from, setFrom],
                    ['目标色', to, setTo],
                  ] as const
                ).map(([label, value, setter]) => (
                  <div className="lab-culori-input" key={label}>
                    <input
                      type="color"
                      aria-label={`${label}取色器`}
                      value={normaliseForInput(value)}
                      onChange={(e) => setter(e.target.value)}
                    />
                    <input
                      type="text"
                      aria-label={label}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>
              <small className="lab-culori-presets">
                {PAIRS.map(([a, b, name]) => (
                  <button key={name} type="button" className="lab-culori-preset" onClick={() => { setFrom(a); setTo(b); }}>
                    <span className="lab-culori-preset__bar" style={{ background: `linear-gradient(90deg, ${a}, ${b})` }} />
                    {name}
                  </button>
                ))}
              </small>
            </div>

            <Select<Space> label="插值空间" value={space} options={SPACES} onChange={setSpace} />
            <Select<Fixup> label="色相修正 fixup" value={fixup} options={FIXUPS} onChange={setFixup} />
            <Range label="渐变色阶数" value={steps} min={2} max={48} step={1} unit=" 档" onChange={setSteps} hint="每一档都由 Culori 插值器算出并单独格式化。" />
            <Range label="OKLCH 亮度偏移" value={shift} min={-40} max={40} step={1} unit="%" onChange={setShift} hint="先转到 oklch 再改 L，然后插值。" />

            <div className="lab-options">
              <label>
                <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
                用 filterInvert(1, 'rgb') 反相两个端点
              </label>
            </div>
            <Status>全部数值由 Culori 现场计算，页面里没有任何预烘焙的色值。</Status>
          </>
        }
      >
        {!result.ok ? (
          <ErrorNote>{result.error}</ErrorNote>
        ) : (
          <>
            <div className="lab-culori-gradient" style={{ backgroundImage: result.data.gradient }} role="img" aria-label={`在 ${space} 空间插值出的 ${result.data.stops.length} 段渐变`} />
            <div className="lab-culori-ends">
              <div className="lab-culori-end">
                <span className="lab-culori-swatch" style={{ background: formatHex(result.data.from) }} />
                <code>{formatHex(result.data.from)}</code>
              </div>
              <div className="lab-culori-end">
                <span className="lab-culori-swatch" style={{ background: formatHex(result.data.mid) }} />
                <code>{formatHex(result.data.mid)}</code>
              </div>
              <div className="lab-culori-end">
                <span className="lab-culori-swatch" style={{ background: formatHex(result.data.to) }} />
                <code>{formatHex(result.data.to)}</code>
              </div>
            </div>

            <Stats>
              <Stat label="ΔE（CIELAB 欧氏）" value={result.data.deltaLab.toFixed(2)} />
              <Stat label="ΔE2000（CIEDE2000）" value={result.data.deltaE2000.toFixed(2)} />
              <Stat label="WCAG 对比度" value={`${result.data.contrast.toFixed(2)}:1`} />
            </Stats>

            <p className="lab-culori-note">
              中点 <code>{formatHex(result.data.mid)}</code> 在 <code>{result.data.space}</code> 空间由 {result.data.stops.length} 次
              interpolate() 求得{result.data.inverse ? '（两端先经过 filterInvert）' : ''}。
              换成 sRGB 插值时中点会经过暗灰，换成 LCH / OKLCH 则保持亮度 — 这就是感知均匀的差别。
            </p>
          </>
        )}
      </LabLayout>

      {data ? (
        <div style={{ marginTop: 22 }}>
          <DataTable
            head={['目标空间', '起始色', '中点', '目标色']}
            caption="同一对颜色在不同色彩空间里的坐标（formatCss 输出，未做裁剪）"
            rows={data.rows.map((r) => [
              <code key={r.space}>{r.space}</code>,
              <span key={`a-${r.space}`} className="lab-culori-cell">
                <i className="lab-culori-dot" style={{ background: r.midHex }} />
                <code>{r.from}</code>
              </span>,
              <span key={`m-${r.space}`} className="lab-culori-cell">
                <i className="lab-culori-dot" style={{ background: r.midHex }} />
                <code>{r.mid}</code>
              </span>,
              <span key={`b-${r.space}`} className="lab-culori-cell">
                <i className="lab-culori-dot" style={{ background: r.midHex }} />
                <code>{r.to}</code>
              </span>,
            ])}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <Code text={snippet} onCopy={onCopy} label="Culori 调用" maxHeight={360} />
      </div>
    </Lab>
  );
}

/** `<input type="color">` only understands #rrggbb; non-hex input simply shows the last valid one. */
function normaliseForInput(value: string): string {
  const parsed = parse(value.trim());
  if (!parsed) return '#000000';
  return formatHex(parsed);
}
