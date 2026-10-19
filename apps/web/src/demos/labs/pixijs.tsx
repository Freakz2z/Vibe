import { useEffect, useMemo, useRef, useState } from 'react';
// Official CSP polyfills replace runtime code generation with static uniform synchronizers.
import 'pixi.js/unsafe-eval';
import { Application, CanvasSource, Container, Sprite, Texture, type Ticker } from 'pixi.js';
import type { DemoCopyHandler } from '../types';
import { Code, ErrorNote, Lab, Range, Select, Stat, Stats, Status, useMotionOk, useThemeColors } from '../lab-kit';

type Blend = 'normal' | 'add' | 'multiply' | 'screen';

const BLENDS: readonly (readonly [Blend, string])[] = [
  ['normal', 'normal 普通'],
  ['add', 'add 相加'],
  ['multiply', 'multiply 正片叠底'],
  ['screen', 'screen 滤色'],
];

const MAX_SPRITES = 12000;

/** Radial dot drawn on an offscreen canvas — no external asset, no network. */
function makeDotTexture(variant: number, accent: string): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const source = new CanvasSource({ resource: canvas, antialias: true, scaleMode: 'linear' });
  if (!ctx) return new Texture({ source });
  ctx.clearRect(0, 0, 64, 64);
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, accent);
  g.addColorStop(0.5, accent);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.5 + variant * 0.09;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 32, 31, 0, Math.PI * 2);
  ctx.fill();
  return new Texture({ source });
}

/** PixiJS v8：await app.init + 数千 Sprite 共享少量 Texture，混合模式决定能否合批。 */
export default function PixijsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const colors = useThemeColors();
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const frameRef = useRef({ ms: 16.7, tick: 0 });

  const [count, setCount] = useState(3000);
  const [textureCount, setTextureCount] = useState(1);
  const [blend, setBlend] = useState<Blend>('normal');
  const [appToken, setAppToken] = useState(0);
  const [frameMs, setFrameMs] = useState(16.7);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const accent = colors.accent ?? '#d95a3f';
  const surface = colors.surface ?? '#fffdf9';

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    // app.init() 是异步的：cleanup 可能在它 resolve 之前就跑（React StrictMode
    // 的双调用尤其如此），此时 Application 还没有 renderer，destroy() 会直接抛错。
    // 因此把「是否已经 init 成功」和「是否已经拆除」分开记录，保证拆除只发生一次、
    // 且只发生在 renderer 存在之后。
    let initialised = false;
    let teardownRequested = false;
    let destroyed = false;
    const app = new Application();
    appRef.current = null;
    setError(null);

    const teardown = () => {
      teardownRequested = true;
      if (destroyed || !initialised) return;
      destroyed = true;
      if (appRef.current === app) appRef.current = null;
      app.destroy(true, { children: true, texture: true, textureSource: true });
    };

    void (async () => {
      try {
        await app.init({
          resizeTo: host,
          backgroundColor: surface,
          antialias: true,
          preference: 'webgl',
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'WebGL 初始化失败');
        return;
      }
      initialised = true;
      if (cancelled || teardownRequested) {
        teardown();
        return;
      }
      host.appendChild(app.canvas);
      appRef.current = app;
      // Reduced motion: draw one frame, then keep the ticker stopped.
      if (!motionOk) app.stop();
      setAppToken((n) => n + 1);
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [nonce, motionOk, surface]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = new Container();
    app.stage.removeChildren();
    app.stage.addChild(layer);

    const textures = Array.from({ length: textureCount }, (_, i) => makeDotTexture(i, accent));
    const safeCount = Math.min(count, MAX_SPRITES);
    const cx = new Float32Array(safeCount);
    const cy = new Float32Array(safeCount);
    const orbit = new Float32Array(safeCount);
    const phase = new Float32Array(safeCount);
    const rate = new Float32Array(safeCount);
    const sprites: Sprite[] = [];

    for (let i = 0; i < safeCount; i += 1) {
      const sprite = new Sprite(textures[i % textureCount]);
      const a = (i * 0.6180339887) % 1;
      const b = (i * 0.7548776662) % 1;
      sprite.anchor.set(0.5);
      sprite.scale.set(0.5 + a * 1.6);
      sprite.alpha = 0.3 + b * 0.55;
      sprite.blendMode = blend;
      cx[i] = 16 + a * Math.max(1, app.screen.width - 32);
      cy[i] = 16 + b * Math.max(1, app.screen.height - 32);
      orbit[i] = 6 + b * 26;
      phase[i] = a * Math.PI * 2;
      rate[i] = 0.0006 + b * 0.0014;
      sprite.x = cx[i];
      sprite.y = cy[i];
      layer.addChild(sprite);
      sprites.push(sprite);
    }

    const tick = (ticker: Ticker) => {
      const t = ticker.lastTime;
      for (let i = 0; i < sprites.length; i += 1) {
        const s = sprites[i];
        s.x = cx[i] + Math.cos(t * rate[i] + phase[i]) * orbit[i];
        s.y = cy[i] + Math.sin(t * rate[i] * 1.3 + phase[i]) * orbit[i] * 0.6;
      }
      frameRef.current.ms = frameRef.current.ms * 0.92 + (ticker.deltaMS || 16.7) * 0.08;
      frameRef.current.tick += 1;
      if (frameRef.current.tick % 15 === 0) setFrameMs(frameRef.current.ms);
    };
    app.ticker.add(tick);
    app.render();

    return () => {
      // app effect 的 cleanup 先跑；renderer 为 null 说明 Application 已被拆除。
      if (app.renderer) app.ticker.remove(tick);
      layer.destroy({ children: true });
      for (const texture of textures) texture.destroy(true);
    };
  }, [appToken, count, textureCount, blend, accent, surface]);

  const snippet = useMemo(
    () =>
      [
        `import 'pixi.js/unsafe-eval'; // 官方 CSP 兼容实现，不需要放宽 script-src`,
        `import { Application, CanvasSource, Container, Sprite, Texture } from 'pixi.js';`,
        ``,
        `// PixiJS v8 必须 await app.init，画布是 app.canvas（v7 的 app.view 已移除）`,
        `const app = new Application();`,
        `await app.init({ resizeTo: host, antialias: true, preference: 'webgl', autoDensity: true });`,
        `host.appendChild(app.canvas);`,
        ``,
        `// 纹理画在离屏 canvas 上，不依赖任何外部图片`,
        `const texture = new Texture({ source: new CanvasSource({ resource: offscreen, antialias: true }) });`,
        ``,
        `// ${count.toLocaleString('zh-CN')} 个 Sprite 只用 ${textureCount} 张纹理 —— 合批的前提`,
        `for (let i = 0; i < ${count}; i += 1) {`,
        `  const sprite = new Sprite(textures[i % ${textureCount}]);`,
        `  sprite.blendMode = '${blend}';   // 混合模式不同就不能合批`,
        `  layer.addChild(sprite);`,
        `}`,
        ``,
        `// 销毁：连同子节点、纹理与纹理源一起释放`,
        `app.destroy(true, { children: true, texture: true, textureSource: true });`,
      ].join('\n'),
    [blend, count, textureCount],
  );

  return (
    <Lab
      title="PixiJS 精灵合批"
      badge={<span className="demo-live-badge">pixi.js v8.6.6</span>}
      reset={() => {
        setCount(3000);
        setTextureCount(1);
        setBlend('normal');
        setNonce((n) => n + 1);
      }}
    >
      <div className="lab-layout lab-layout--toolbar">
        <div className="lab-controls">
          <Select<Blend> label="混合模式" value={blend} options={BLENDS} onChange={setBlend} />
          <Range label="精灵数量" value={count} min={500} max={MAX_SPRITES} step={100} onChange={setCount} />
          <Range
            label="纹理数量"
            value={textureCount}
            min={1}
            max={6}
            step={1}
            onChange={setTextureCount}
            hint="调整共享纹理的数量。"
          />
          <p className="lab-motion-note">
            PixiJS v8 没有公开绘制调用计数器，精灵共享纹理；不同纹理仍可能在同一批次中绘制。帧耗时来自 ticker.deltaMS，包含帧间等待时间，不代表 GPU 渲染耗时。
          </p>
          {!motionOk ? <Status>系统开启了「减少动态效果」，ticker 已停止，只绘制一帧静态图。</Status> : null}
          {error ? <ErrorNote onRetry={() => setNonce((n) => n + 1)}>{error}</ErrorNote> : null}
        </div>

        <div className="lab-stage">
          <div className="lab-pixi-viewport" ref={hostRef} />
          <div className="lab-output-stats">
            <Stats>
              <Stat label="精灵" value={count.toLocaleString('zh-CN')} />
              <Stat label="不同纹理" value={textureCount} />
              <Stat label="混合模式" value={blend} />

              <Stat label="实测帧耗时" value={`${frameMs.toFixed(1)} ms`} />
            </Stats>
          </div>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="PixiJS 调用" maxHeight={340} />
    </Lab>
  );
}
