import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// The default `lottie-web` build ships an expressions engine that calls eval(),
// which our CSP forbids. `lottie_light` is the official build with the
// expressions feature removed entirely — same renderer, no eval anywhere.
import lottie from 'lottie-web/build/player/esm/lottie_light.min.js';
import type { AnimationItem } from 'lottie-web';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, Range, Segmented, Stat, Stats, Status, useMotionOk, useThemeColors } from '../lab-kit';
import '../styles/animation.css';

type LottieJson = Record<string, unknown>;

/** Stage size of the generated composition. */
const STAGE = 320;

/** Readable segment boundaries, as a fraction of the total frame count. */
interface Segment {
  id: string;
  label: string;
  from: number;
  to: number;
  detail: string;
}

const SEGMENTS: readonly Segment[] = [
  { id: 'stroke', label: '描边', from: 0, to: 0.34, detail: '环形路径 trim paths 画到 100%' },
  { id: 'check', label: '勾选', from: 0.34, to: 0.7, detail: '勾线擦除式绘出并回弹' },
  { id: 'orbit', label: '环绕', from: 0.7, to: 1, detail: '拖尾沿贝塞尔轨道绕行，柱状图错峰生长' },
];

const SEGMENT_IDS = ['stroke', 'check', 'orbit'] as const;
type SegmentId = (typeof SEGMENT_IDS)[number];

interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(input: string | undefined, fallback: string): RGB {
  const raw = (input ?? fallback).trim();
  const rgba = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return {
      r: ((parts[0] ?? 0) % 256) / 255,
      g: ((parts[1] ?? 0) % 256) / 255,
      b: ((parts[2] ?? 0) % 256) / 255,
      a: parts.length > 3 ? (parts[3] as number) : 1,
    };
  }
  const hex = raw.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n) || hex.length < 3) return parseColor(fallback, '#d95a3f');
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
}

const rgba = (c: RGB, alpha = 1): number[] => [c.r, c.g, c.b, c.a * alpha];

/* ------------------------------------------------------------------ */
/* Keyframe helpers                                                    */
/* ------------------------------------------------------------------ */

interface IO {
  i: [number, number];
  o: [number, number];
}

const E_SOFT: IO = { i: [0.34, 1], o: [0.24, 0] };
const E_OUT: IO = { i: [0.16, 1], o: [0.3, 0] };
const E_IN: IO = { i: [0.62, 0], o: [0.85, 0.32] };
const E_BOTH: IO = { i: [0.44, 1], o: [0.56, 0] };
const E_LINEAR: IO = { i: [0.333, 0.333], o: [0.667, 0.667] };

interface KeyFrame {
  t: number;
  s: number | number[];
  e?: IO;
  /** Spatial (bezier-path) tangents — only meaningful on position properties. */
  to?: number[];
  ti?: number[];
}

const solid = (k: number | number[]) => ({ a: 0, k });

/** Builds a keyframed Lottie property. The last keyframe gets no easing handles. */
function prop(frames: KeyFrame[]): Record<string, unknown> {
  return {
    a: 1,
    k: frames.map((f, index) => {
      const node: Record<string, unknown> = { t: f.t, s: typeof f.s === 'number' ? [f.s] : f.s };
      if (f.to) node.to = f.to;
      if (f.ti) node.ti = f.ti;
      if (index < frames.length - 1) {
        const easing = f.e ?? E_SOFT;
        node.i = { x: [easing.i[0]], y: [easing.i[1]] };
        node.o = { x: [easing.o[0]], y: [easing.o[1]] };
      }
      return node;
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Shape helpers                                                       */
/* ------------------------------------------------------------------ */

const stroke = (color: number[], width: number) => ({ ty: 'st', c: solid(color), o: solid(100), w: solid(width), lc: 2, lj: 2 });
const fill = (color: number[], opacity = 100) => ({ ty: 'fl', c: solid(color), o: solid(opacity), r: 1 });
const ellipse = (size: number[], pos: number[] = [0, 0]) => ({ ty: 'el', p: solid(pos), s: solid(size) });
const rect = (size: number[], pos: number[], radius = 0) => ({ ty: 'rc', p: solid(pos), s: solid(size), r: solid(radius) });
const polyline = (points: number[][]) => ({
  ty: 'sh',
  ks: { a: 0, k: { i: points.map(() => [0, 0]), o: points.map(() => [0, 0]), v: points, c: false } },
});

/** Trim Paths modifier: start %, end % and angular offset — the draw-on / wipe-out engine. */
const trim = (start: KeyFrame[], end: KeyFrame[], offset: KeyFrame[]) => ({
  ty: 'tm',
  s: prop(start),
  e: prop(end),
  o: prop(offset),
  m: 1,
});

const groupTransform = (over: Record<string, unknown> = {}) => ({
  ty: 'tr',
  p: solid([0, 0]),
  a: solid([0, 0]),
  s: solid([100, 100]),
  r: solid(0),
  o: solid(100),
  sk: solid(0),
  sa: solid(0),
  ...over,
});

const layerKs = (over: Record<string, unknown> = {}) => ({
  o: solid(100),
  r: solid(0),
  p: solid([STAGE / 2, STAGE / 2]),
  a: solid([0, 0]),
  s: solid([100, 100]),
  ...over,
});

const shapeLayer = (ind: number, nm: string, ks: Record<string, unknown>, shapes: unknown[], ip: number, op: number) => ({
  ddd: 0,
  ind,
  ty: 4,
  nm,
  sr: 1,
  ks,
  ao: 0,
  shapes,
  ip,
  op,
  st: 0,
  bm: 0,
});

/** Spatial keyframes along a circle: real bezier tangents, not linear hops. */
function orbitalFrames(cx: number, cy: number, radius: number, angles: number[], from: number, to: number, F: (p: number) => number): KeyFrame[] {
  return angles.map((angle, index) => {
    const rad = (angle * Math.PI) / 180;
    const px = cx + radius * Math.cos(rad);
    const py = cy + radius * Math.sin(rad);
    const tx = -Math.sin(rad);
    const ty = Math.cos(rad);
    const step = ((angles[Math.min(index + 1, angles.length - 1)] - angle) * Math.PI) / 180;
    const k = radius * Math.abs(step) * 0.5;
    return {
      t: F(from + (to - from) * (index / (angles.length - 1))),
      s: [Math.round(px * 100) / 100, Math.round(py * 100) / 100],
      to: [px + tx * k, py + ty * k],
      ti: [px - tx * k, py - ty * k],
    };
  });
}

/**
 * Builds a genuine multi-layer Lottie composition in memory — no fetch, no CDN,
 * no base64 assets. Original work for this site (MIT), authored as a JS object.
 *
 * Layers (top to bottom): 勾选 / 环绕拖尾 / 环形进度 / 柱状图 / 底线 / 背景光晕.
 * Every layer carries its own keyframed transform and its own trim-path or
 * shape reveal, so scrubbing the timeline visibly changes the render.
 */
function buildAnimation(frameRate: number, colors: Record<string, string>): LottieJson {
  const total = Math.max(36, Math.round(frameRate * 4));
  const F = (p: number) => Math.max(0, Math.min(total, Math.round(p * total)));

  const accent = parseColor(colors.accent, '#d95a3f');
  const accentStrong = parseColor(colors['accent-strong'], '#b8432b');
  const ink = parseColor(colors.ink, '#211f1b');
  const line = parseColor(colors['line-strong'], 'rgba(45,38,30,0.17)');

  const flat = (from: number, to: number) => [
    { t: F(from), s: 0 },
    { t: F(to), s: 0 },
  ];

  const WIPE_IN = { t: F(0.3), s: 0, e: E_OUT };
  const WIPE_OUT = { t: F(0.93), s: 0, e: E_IN };

  /* --- layer 1: 完成勾选（描边沿路径绘出，末段从起点擦除） --- */
  const check = shapeLayer(
    1,
    'check',
    layerKs({
      o: prop([
        { t: 0, s: 0, e: E_LINEAR },
        { t: F(0.34), s: 0 },
        { t: F(0.42), s: 100 },
        { t: F(0.86), s: 100, e: E_LINEAR },
        { t: F(0.97), s: 0 },
      ]),
      r: prop([
        { t: F(0.42), s: -16, e: E_OUT },
        { t: F(0.56), s: 0, e: E_BOTH },
        { t: F(0.82), s: 11 },
        { t: F(0.92), s: 0 },
      ]),
      s: prop([
        { t: F(0.42), s: [34, 34], e: E_OUT },
        { t: F(0.54), s: [122, 122], e: E_BOTH },
        { t: F(0.62), s: [100, 100], e: E_BOTH },
        { t: F(0.84), s: [108, 108], e: E_BOTH },
        { t: F(0.92), s: [100, 100] },
      ]),
      p: solid([STAGE / 2, 154]),
    }),
    [
      {
        ty: 'gr',
        nm: 'check-group',
        it: [
          polyline([
            [-40, 4],
            [-13, 30],
            [40, -26],
          ]),
          stroke(rgba(accentStrong), 15),
          trim(
            [WIPE_IN, { t: F(0.86), s: 0, e: E_IN }, { t: F(0.99), s: 100 }],
            [WIPE_IN, { t: F(0.58), s: 100, e: E_LINEAR }, { t: F(0.99), s: 100 }],
            flat(0, 1),
          ),
          groupTransform(),
        ],
      },
    ],
    F(0.34),
    total,
  );

  /* --- layer 2: 环绕拖尾（空间贝塞尔位置关键帧 + 自动朝向） --- */
  const orbitAngles = [-95, 25, 145, 265];
  const orbitTilt = orbitAngles.map((a) => a + 90);
  const orbit = shapeLayer(
    2,
    'orbit-comet',
    layerKs({
      o: prop([
        { t: 0, s: 0, e: E_LINEAR },
        { t: F(0.68), s: 0 },
        { t: F(0.74), s: 100 },
        { t: F(0.93), s: 100, e: E_LINEAR },
        { t: F(1), s: 0 },
      ]),
      p: prop(orbitalFrames(STAGE / 2, STAGE / 2, 132, orbitAngles, 0.7, 0.96, F)),
      r: prop(orbitTilt.map((angle, index) => ({ t: F(0.7 + 0.26 * (index / (orbitTilt.length - 1))), s: angle, e: E_LINEAR }))),
      s: prop([
        { t: F(0.7), s: [52, 52], e: E_OUT },
        { t: F(0.77), s: [100, 100], e: E_BOTH },
        { t: F(0.96), s: [86, 86] },
      ]),
    }),
    [
      {
        ty: 'gr',
        nm: 'comet-group',
        it: [
          polyline([
            [-44, 0],
            [8, 0],
          ]),
          stroke(rgba(accent), 9),
          ellipse([20, 20], [16, 0]),
          fill(rgba(accentStrong)),
          groupTransform(),
        ],
      },
    ],
    F(0.7),
    total,
  );

  /* --- layer 3: 环形进度（trim paths 0→100，再 100→0 擦除） --- */
  const ring = shapeLayer(
    3,
    'progress-ring',
    layerKs({
      r: prop([
        { t: 0, s: 0, e: E_LINEAR },
        { t: total, s: 190 },
      ]),
      s: prop([
        { t: 0, s: [92, 92], e: E_BOTH },
        { t: F(0.4), s: [103, 103], e: E_BOTH },
        { t: total, s: [92, 92] },
      ]),
    }),
    [
      {
        ty: 'gr',
        nm: 'ring-group',
        it: [
          ellipse([230, 230]),
          stroke(rgba(accent), 17),
          trim(
            flat(0, 1),
            [
              { t: 0, s: 0, e: E_LINEAR },
              { t: F(0.03), s: 6, e: E_OUT },
              { t: F(0.3), s: 100, e: E_LINEAR },
              { t: F(0.62), s: 100, e: E_IN },
              { t: F(0.99), s: 0 },
            ],
            [
              { t: 0, s: 0, e: E_LINEAR },
              { t: F(0.6), s: 0, e: E_IN },
              { t: F(0.99), s: 360 },
            ],
          ),
          groupTransform(),
        ],
      },
    ],
    0,
    total,
  );

  /* --- layer 4: 柱状图（三个形状各自错峰的关键帧组变换） --- */
  const baseline = 258;
  const barHeights = [62, 96, 76];
  const barWidth = 46;
  const barStarts = [0.7, 0.75, 0.8];
  const barTilts = [8, -9, 6];
  const bars = shapeLayer(
    4,
    'bars',
    layerKs({ o: solid(100) }),
    barHeights.map((h, index) => {
      const from = barStarts[index];
      const tilt = barTilts[index];
      return {
        ty: 'gr',
        nm: `bar-${index}`,
        it: [
          rect([barWidth, h], [0, -h / 2], 10),
          fill(rgba(accent, 0.32 + index * 0.22)),
          stroke(rgba(index === 1 ? accentStrong : ink, 0.6), 3),
          groupTransform({
            p: solid([STAGE / 2 + (index - 1) * 58, baseline]),
            r: prop([
              { t: F(from), s: tilt, e: E_OUT },
              { t: F(from + 0.09), s: 0 },
            ]),
            s: prop([
              { t: F(from), s: [100, 0], e: E_OUT },
              { t: F(from + 0.075), s: [118, 104], e: E_BOTH },
              { t: F(from + 0.12), s: [100, 100] },
            ]),
          }),
        ],
      };
    }),
    F(0.7),
    total,
  );

  /* --- layer 5: 底线（另一条独立的 trim paths 擦除动画） --- */
  const underline = shapeLayer(
    5,
    'underline',
    layerKs({
      o: prop([
        { t: 0, s: 0, e: E_LINEAR },
        { t: F(0.3), s: 0 },
        { t: F(0.38), s: 100, e: E_LINEAR },
        { t: F(0.9), s: 100, e: E_LINEAR },
        { t: F(0.99), s: 0 },
      ]),
      p: solid([STAGE / 2, 288]),
      r: prop([
        { t: F(0.3), s: -3, e: E_BOTH },
        { t: F(0.45), s: 0 },
      ]),
    }),
    [
      {
        ty: 'gr',
        nm: 'underline-group',
        it: [
          polyline([
            [-108, 0],
            [108, 0],
          ]),
          stroke(rgba(accent, 0.85), 6),
          trim(
            [WIPE_OUT, { t: F(1), s: 100 }],
            [WIPE_IN, { t: F(0.42), s: 100, e: E_LINEAR }, { t: F(1), s: 100 }],
            flat(0, 1),
          ),
          groupTransform(),
        ],
      },
    ],
    0,
    total,
  );

  /* --- layer 6: 背景光晕（漂移 + 呼吸，提供合成纵深） --- */
  const halo = shapeLayer(
    6,
    'halo',
    layerKs({
      o: prop([
        { t: 0, s: 0, e: E_LINEAR },
        { t: F(0.12), s: 0 },
        { t: F(0.3), s: 46, e: E_BOTH },
        { t: F(0.72), s: 62, e: E_BOTH },
        { t: total, s: 40 },
      ]),
      p: prop([
        { t: 0, s: [132, 152], e: E_BOTH },
        { t: F(0.5), s: [192, 140], e: E_BOTH },
        { t: total, s: [146, 178] },
      ]),
      s: prop([
        { t: 0, s: [88, 88], e: E_BOTH },
        { t: F(0.5), s: [116, 116], e: E_BOTH },
        { t: total, s: [92, 92] },
      ]),
    }),
    [
      {
        ty: 'gr',
        nm: 'halo-group',
        it: [ellipse([196, 196]), fill(rgba(line, 1)), groupTransform()],
      },
      {
        ty: 'gr',
        nm: 'halo-core',
        it: [ellipse([120, 120]), fill(rgba(accent, 0.18)), groupTransform()],
      },
    ],
    0,
    total,
  );

  return {
    v: '5.9.0',
    fr: frameRate,
    ip: 0,
    op: total,
    w: STAGE,
    h: STAGE,
    nm: 'lab-lottie-original',
    ddd: 0,
    assets: [],
    layers: [check, orbit, ring, bars, underline, halo],
    markers: SEGMENTS.map((segment) => ({
      tm: F(segment.from),
      cm: segment.label,
      dr: Math.max(1, F(segment.to) - F(segment.from)),
    })),
  };
}

/**
 * CSP guard: Lottie expressions are stored as a string under an `x` key inside a
 * property object. Reject anything shaped like that — no eval, no new Function.
 */
function findExpressionPath(node: unknown, trail = '$'): string | null {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const hit = findExpressionPath(node[i], `${trail}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key === 'x' && typeof record[key] === 'string') return `${trail}.${key}`;
      const hit = findExpressionPath(record[key], `${trail}.${key}`);
      if (hit) return hit;
    }
  }
  return null;
}

/** Lottie-web：本地构造的多图层 Lottie JSON，SVG 渲染器，逐帧 / 分段控制。 */
export default function LottieWebLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const colors = useThemeColors();
  const segmentStartRef = useRef(0);
  const speedRef = useRef(1);

  const [frameRate, setFrameRate] = useState(30);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [frame, setFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [paused, setPaused] = useState(false);
  const [segment, setSegment] = useState<SegmentId>('stroke');
  const [error, setError] = useState<string | null>(null);

  speedRef.current = speed;
  const animationData = useMemo(() => buildAnimation(frameRate, colors), [frameRate, colors]);
  const op = animationData.op as number;
  const activeSegment = useMemo(() => SEGMENTS.find((s) => s.id === segment) ?? SEGMENTS[0], [segment]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const expression = findExpressionPath(animationData);
    if (expression) {
      setError(`检测到 Lottie 表达式（${expression}），按站点 CSP 策略拒绝加载。`);
      return;
    }

    let anim: AnimationItem | null = null;
    try {
      container.innerHTML = '';
      anim = lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop,
        autoplay: motionOk,
        animationData: JSON.parse(JSON.stringify(animationData)),
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lottie 加载失败');
      return;
    }

    animRef.current = anim;
    setError(null);
    segmentStartRef.current = 0;
    anim.setSpeed(speedRef.current);
    setFrame(0);
    setTotalFrames(op);
    setPaused(motionOk ? false : true);

    const onEnter = (event: { currentTime: number; totalTime: number }) => {
      setFrame(Math.round(event.currentTime + segmentStartRef.current));
    };
    const onComplete = () => setPaused(true);
    anim.addEventListener('enterFrame', onEnter);
    anim.addEventListener('complete', onComplete);

    return () => {
      anim?.removeEventListener('enterFrame', onEnter);
      anim?.removeEventListener('complete', onComplete);
      anim?.destroy();
      animRef.current = null;
      container.innerHTML = '';
    };
  }, [animationData, loop, motionOk]);

  useEffect(() => {
    const anim = animRef.current;
    if (anim) anim.setSpeed(speed);
  }, [speed]);

  const jumpTo = useCallback((target: number) => {
    const anim = animRef.current;
    if (!anim) return;
    const clamped = Math.max(0, Math.min(op - 1, Math.round(target)));
    segmentStartRef.current = 0;
    anim.resetSegments(true);
    anim.setDirection(1);
    anim.goToAndStop(clamped, true);
    setFrame(clamped);
    setPaused(true);
  }, [op]);

  const playSegment = useCallback(
    (id: SegmentId) => {
      const anim = animRef.current;
      if (!anim) return;
      const seg = SEGMENTS.find((s) => s.id === id);
      if (!seg) return;
      setSegment(id);
      const from = Math.round(seg.from * op);
      const to = Math.max(from + 1, Math.round(seg.to * op) - 1);
      segmentStartRef.current = from;
      anim.setDirection(1);
      anim.playSegments([from, to], true);
      setFrame(from);
      setPaused(false);
    },
    [op],
  );

  const snippet = useMemo(
    () =>
      [
        `import lottie from 'lottie-web/build/player/esm/lottie_light.min.js'; // 官方无表达式构建，零 eval`,
        ``,
        `// 本站原创 JSON（MIT），直接在模块里构造：${(animationData.layers as unknown[]).length} 个形状图层`,
        `// 勾选 / 环绕拖尾 / 环形进度 / 柱状图 / 底线 / 背景光晕`,
        `// 其中 4 条描边由 Trim Paths（s/e/o）驱动，逐帧看是「画出来」而不是旋转。`,
        ``,
        `// 站点 CSP 不允许 eval：加载前递归扫一遍有没有表达式（属性对象里的字符串 x）`,
        `if (findExpressionPath(animationData)) throw new Error('检测到 Lottie 表达式，拒绝加载');`,
        ``,
        `const anim = lottie.loadAnimation({`,
        `  container,`,
        `  renderer: 'svg',`,
        `  loop: ${loop},`,
        `  autoplay: ${motionOk},`,
        `  animationData: structuredClone(animationData),`,
        `  rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },`,
        `});`,
        ``,
        `// 真实的逐帧 / 分段控制`,
        `anim.addEventListener('enterFrame', (e) => setFrame(Math.round(e.currentTime)));`,
        `anim.setSpeed(${speed});          // 走播放器速度，不改 JSON`,
        `anim.goToAndStop(frame, true);    // 精确暂停在某一帧`,
        `anim.playSegments([from, to], true); // 只播一个区段`,
        `anim.destroy();                   // 卸载时移除 SVG 与内部状态`,
      ].join('\n'),
    [animationData, loop, motionOk, speed],
  );

  return (
    <Lab
      title="Lottie-web 多图层矢量动画"
      badge={<span className="demo-live-badge">lottie-web 5.12.2</span>}
      reset={() => {
        setFrameRate(30);
        setSpeed(1);
        setLoop(true);
        setSegment('stroke');
        jumpTo(0);
      }}
    >
      <div className="lab-layout">
        <div className="lab-controls">
          <Range label="帧率 fr" value={frameRate} min={12} max={60} step={6} unit=" fps" onChange={setFrameRate} hint="帧率写在 JSON 里，改它会重建整段动画数据。" />
          <Range label="播放速度" value={speed} min={0.25} max={3} step={0.25} unit=" 倍" onChange={setSpeed} hint="走 anim.setSpeed()，JSON 不变。" />
          <Range
            label="当前帧"
            value={Math.min(frame, Math.max(1, totalFrames))}
            min={0}
            max={Math.max(1, totalFrames - 1)}
            step={1}
            onChange={jumpTo}
            hint="拖动即 goToAndStop(frame, true)，会真的停在该帧。"
          />
          <div className="lab-lottie-frames">
            <button type="button" className="button button--secondary button--small" onClick={() => jumpTo(frame - 1)}>
              ◀ 上一帧
            </button>
            <button type="button" className="button button--secondary button--small" onClick={() => jumpTo(frame + 1)}>
              下一帧 ▶
            </button>
            <button
              type="button"
              className="button button--primary button--small"
              onClick={() => {
                const anim = animRef.current;
                if (!anim) return;
                if (paused) {
                  anim.play();
                  setPaused(false);
                } else {
                  anim.pause();
                  setPaused(true);
                }
              }}
            >
              {paused ? '播放' : '暂停'}
            </button>
          </div>
          <Segmented<SegmentId>
            label="区段跳转"
            value={segment}
            options={SEGMENT_IDS.map(id => [id, SEGMENTS.find(s => s.id === id)?.label ?? id] as const)}
            onChange={playSegment}
          />
          <p className="lab-status" data-tone="plain">
            区段「{activeSegment.label}」：{activeSegment.detail}（第 {Math.round(activeSegment.from * op)}–{Math.round(activeSegment.to * op)} 帧）
          </p>
          <div className="lab-options">
            <label>
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              循环播放
            </label>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const anim = animRef.current;
                if (!anim) return;
                anim.setDirection(-1);
                anim.play();
                setPaused(false);
              }}
            >
              反向
            </button>
          </div>
          <Stats>
            <Stat label="当前帧" value={frame} />
            <Stat label="总帧数" value={totalFrames} />
            <Stat label="图层数" value={(animationData.layers as unknown[]).length} />
          </Stats>
          {!motionOk ? <Status>系统开启了「减少动态效果」，动画以 autoplay=false 载入，只停在首帧。</Status> : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </div>

        <div className="lab-stage">
          <div className="lab-lottie-canvas">
            <div ref={containerRef} className="lab-lottie-canvas__host" />
          </div>
          <ul className="lab-lottie-legend">
            <li>
              <b>环形进度</b>
              <span>Trim Paths 的 e 从 0 画到 100（trim paths + 端点关键帧），末段配合 o 旋转做反向擦除。</span>
            </li>
            <li>
              <b>完成勾选 / 底线</b>
              <span>同一条 trim 路径既用 e 画线、也用 s 从起点擦除，两组关键帧节奏不同。</span>
            </li>
            <li>
              <b>环绕拖尾</b>
              <span>位置是带空间切线（to / ti）的贝塞尔关键帧，沿圆弧而非直线跳转，rotation 同步朝向。</span>
            </li>
            <li>
              <b>柱状图</b>
              <span>三个形状各自的组变换关键帧错峰起跳，各图层 opacity / scale / rotation 互相独立。</span>
            </li>
          </ul>
          <p className="lab-lottie-note">本站原创六图层矢量动画（MIT）。使用官方轻量播放器，支持逐帧查看、分段播放与倒放。</p>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Lottie-web 调用" maxHeight={340} />
    </Lab>
  );
}
