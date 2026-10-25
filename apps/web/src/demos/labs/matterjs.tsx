import { LabControls } from '../lab-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Matter from 'matter-js';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Range, Stat, Stats, Status, useAnimationFrame, useMotionOk, useThemeColors } from '../lab-kit';

interface Palette {
  accent: string;
  line: string;
  lineStrong: string;
  surface: string;
  ink: string;
}

const VIEW_W = 560;
const VIEW_H = 420;

/** Matter.js：真实刚体仿真 + MouseConstraint 拖拽 + Constraint 单摆，全部手写 Canvas 渲染以跟随主题。 */
export default function MatterjsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const colors = useThemeColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const worldRef = useRef<Matter.World | null>(null);
  const mouseRef = useRef<Matter.Mouse | null>(null);
  const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);
  const pendulumsRef = useRef<Matter.Constraint[]>([]);
  const grabRef = useRef<string>('');
  const [bodyCount, setBodyCount] = useState(0);
  const [gravityY, setGravityY] = useState(1);
  const [restitution, setRestitution] = useState(0.35);
  const [grabbed, setGrabbed] = useState<string>('（无）');
  const [nonce, setNonce] = useState(0);
  const [running, setRunning] = useState(motionOk);
  useEffect(() => setRunning(motionOk), [motionOk]);

  const palette = useMemo<Palette>(
    () => ({
      accent: colors.accent ?? '#d95a3f',
      line: colors.line ?? '#e5ddd2',
      lineStrong: colors['line-strong'] ?? '#cfc4bb',
      surface: colors.surface ?? '#fffdf9',
      ink: colors.ink ?? '#1c1b19',
    }),
    [colors.accent, colors.line, colors['line-strong'], colors.surface, colors.ink],
  );
  const paletteRef = useRef(palette);
  paletteRef.current = palette;

  // Canvas is sized in CSS pixels; physics runs in a fixed 720×340 world space.
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    const engine = Matter.Engine.create();
    engine.gravity.y = gravityY;
    // Engine.world is a World (gravity + bounds), not a bare Composite.
    const world = Matter.World.create({ label: 'lab-world' });
    engine.world = world;
    engineRef.current = engine;
    worldRef.current = world;

    const floorY = VIEW_H - 24;
    const wallOpts = { isStatic: true, restitution: restitution, friction: 0.4 };
    Matter.Composite.add(world, [
      Matter.Bodies.rectangle(VIEW_W / 2, floorY, VIEW_W + 80, 48, { ...wallOpts, label: 'ground' }),
      Matter.Bodies.rectangle(-24, VIEW_H / 2, 48, VIEW_H * 2, { ...wallOpts, label: 'wall-left' }),
      Matter.Bodies.rectangle(VIEW_W + 24, VIEW_H / 2, 48, VIEW_H * 2, { ...wallOpts, label: 'wall-right' }),
    ]);

    const mouse = Matter.Mouse.create(host);
    mouseRef.current = mouse;
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, damping: 0.1, render: { visible: false } },
    });
    mouseConstraintRef.current = mouseConstraint;
    Matter.Composite.add(world, mouseConstraint as unknown as Matter.Constraint);
    Matter.Composite.add(world, Matter.Composites.stack(VIEW_W / 2 - 96, 40, 6, 4, 4, 2, (x: number, y: number) => Matter.Bodies.rectangle(x, y, 28, 28, { restitution, friction: 0.35, label: 'box' })));
    setBodyCount(24);
    Matter.Events.on(mouseConstraint, 'mouseup', () => {
      grabRef.current = '';
      setGrabbed('（无）');
    });

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale((w * dpr) / VIEW_W, (h * dpr) / VIEW_H);
      Matter.Mouse.setScale(mouse, { x: VIEW_W / w, y: VIEW_H / h });
      draw(ctx, world, pendulumsRef.current, paletteRef.current, mouseConstraint, () => {});
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    // Reduced motion: paint one static frame so the world is still visible.
    if (!motionOk) draw(ctx, world, pendulumsRef.current, paletteRef.current, null, () => {});

    return () => {
      observer.disconnect();
      Matter.Events.off(mouseConstraint, 'mouseup');
      if (mouseConstraint) Matter.Composite.remove(world, mouseConstraint as unknown as Matter.Constraint, true);
      if (mouse) {
        Matter.Mouse.clearSourceEvents(mouse);
        const m = mouse as unknown as Record<string, EventListener>;
        for (const [name, key] of [['mousemove','mousemove'],['mousedown','mousedown'],['mouseup','mouseup'],['wheel','mousewheel'],['touchmove','mousemove'],['touchstart','mousedown'],['touchend','mouseup']]) host.removeEventListener(name, m[key]);
      }
      pendulumsRef.current = [];
      Matter.Composite.clear(world, false);
      Matter.Engine.clear(engine);
      mouseConstraintRef.current = null;
      mouseRef.current = null;
      worldRef.current = null;
      engineRef.current = null;
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Physics + render loop. Gated on reduced motion.
  const gravityYRef = useRef(gravityY);
  gravityYRef.current = gravityY;
  const countRef = useRef(0);

  useAnimationFrame(running, () => {
    const engine = engineRef.current;
    const ctx = ctxRef.current;
    const world = worldRef.current;
    if (!engine || !ctx || !world) return;
    engine.gravity.y = gravityYRef.current;
    Matter.Engine.update(engine, 1000 / 60);
    draw(ctx, world, pendulumsRef.current, paletteRef.current, mouseConstraintRef.current, (label) => {
      if (grabRef.current === label) return;
      grabRef.current = label;
      setGrabbed(label);
    });
    countRef.current += 1;
    if (countRef.current % 15 === 0) {
      setBodyCount(Matter.Composite.allBodies(world).filter((b) => !b.isStatic).length);
    }
  });

  // Gravity / restitution apply to every future body and to the world itself.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.gravity.y = gravityY;
    for (const body of Matter.Composite.allBodies(engine.world)) {
      body.restitution = body.isStatic ? restitution : restitution;
    }
  }, [gravityY, restitution, nonce]);

  const refresh = useCallback(() => {
    const world = worldRef.current, ctx = ctxRef.current;
    if (!world || !ctx) return;
    setBodyCount(Matter.Composite.allBodies(world).filter(b => !b.isStatic).length);
    draw(ctx, world, pendulumsRef.current, paletteRef.current, mouseConstraintRef.current, () => {});
  }, []);
  useEffect(refresh, [palette, refresh, running]);

  const clearDynamic = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    for (const body of Matter.Composite.allBodies(world)) {
      if (!body.isStatic) Matter.Composite.remove(world, body, true);
    }
    for (const c of pendulumsRef.current) Matter.Composite.remove(world, c, true);
    pendulumsRef.current = [];
    setGrabbed('（无）'); grabRef.current = '';
    if (mouseConstraintRef.current) {
      mouseConstraintRef.current.body = null as unknown as Matter.Body;
      mouseConstraintRef.current.constraint.bodyB = null as unknown as Matter.Body;
    }
    refresh();
  }, [refresh]);

  const stack = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const pile = Matter.Composites.stack(VIEW_W / 2 - 90, 40, 6, 4, 4, 2, (x: number, y: number) => Matter.Bodies.rectangle(x, y, 28, 28, { restitution: restitutionRef.current, friction: 0.35, label: 'box' }));
    for (const body of pile.bodies) {
      body.restitution = restitutionRef.current;
      body.friction = 0.35;
      body.label = 'box';
    }
    Matter.Composite.add(world, pile);
    refresh();
  }, [refresh]);

  const restitutionRef = useRef(restitution);
  restitutionRef.current = restitution;

  const scatter = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const balls = Matter.Composite.create({ label: 'balls' });
    for (let i = 0; i < 18; i += 1) {
      const r = 10 + ((i * 7919) % 13);
      const body = Matter.Bodies.circle(40 + ((i * 137) % (VIEW_W - 80)), 40 + ((i * 61) % 160), r, {
        restitution: restitutionRef.current,
        friction: 0.1,
        label: 'ball',
      });
      balls.bodies.push(body);
    }
    Matter.Composite.add(world, balls);
    refresh();
  }, [refresh]);

  const pendulum = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    for (let i = 0; i < 3; i += 1) {
      const pivotX = 100 + i * 140;
      const length = 120;
      const bob = Matter.Bodies.circle(pivotX + length * 0.9, 60, 13, {
        restitution: 0.2,
        friction: 0.4,
        label: 'bob',
      });
      const rod = Matter.Constraint.create({
        pointA: { x: pivotX, y: 24 },
        bodyB: bob,
        pointB: { x: 0, y: 0 },
        length,
        stiffness: 0.92,
        damping: 0.04,
      });
      pendulumsRef.current.push(rod);
      Matter.Composite.add(world, [bob, rod]);
    }
    refresh();
  }, [refresh]);

  const snippet = useMemo(
    () =>
      [
        `import Matter from 'matter-js';`,
        ``,
        `const engine = Matter.Engine.create();`,
        `const world = Matter.World.create({ label: 'lab-world' });`,
        `engine.world = world;`,
        ``,
        `// 静态墙体：地板 + 左右两堵墙`,
        `Matter.Composite.add(world, [`,
        `  Matter.Bodies.rectangle(W / 2, H - 24, W + 80, 48, { isStatic: true }),`,
        `  Matter.Bodies.rectangle(-24, H / 2, 48, H * 2, { isStatic: true }),`,
        `]);`,
        ``,
        `// 堆叠：Composites.stack 一次生成 6×4 的刚体阵列`,
        `const pile = Matter.Composites.stack(W / 2 - 90, 40, 6, 4, 4, 2, (x, y) =>`,
        `  Matter.Bodies.rectangle(x, y, 28, 28, { restitution: 0.5 }));`,
        `Matter.Composite.add(world, pile);`,
        ``,
        `// 单摆：刚体用 Constraint 挂在固定点上`,
        `Matter.Composite.add(world, [bob, Matter.Constraint.create({`,
        `  pointA: { x: pivotX, y: 24 }, bodyB: bob, length: 120, stiffness: 0.92,`,
        `})]);`,
        ``,
        `// 鼠标拖拽是真正的 MouseConstraint，物理上把刚体拉走`,
        `const mouse = Matter.Mouse.create(host);`,
        `Matter.Composite.add(world, Matter.MouseConstraint.create(engine, {`,
        `  mouse, constraint: { stiffness: 0.2, damping: 0.1 },`,
        `}));`,
        ``,
        `// 固定步长推进`,
        `Matter.Engine.update(engine, 1000 / 60);`,
        ``,
        `// 卸载：移除约束、清掉源事件、清空世界、停掉循环`,
        `Matter.Composite.remove(world, mouseConstraint, true);`,
        `Matter.Mouse.clearSourceEvents(mouse);`,
        `Matter.Composite.clear(world, false);`,
        `Matter.Engine.clear(engine);`,
      ].join('\n'),
    [],
  );

  return (
    <Lab
      title="Matter.js 刚体仿真"
      badge={<span className="demo-live-badge">matter-js 0.20</span>}
      reset={() => {
        setNonce(n => n + 1);
        setRunning(motionOk);
        setGrabbed('（无）');
        setGravityY(1);
        setRestitution(0.35);
      }}
    >
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <Range
            label="重力 Y"
            value={gravityY}
            min={-1}
            max={2}
            step={0.1}
            onChange={setGravityY}
            hint="负值会往上飞。"
          />
          <Range label="弹性 restitution" value={restitution} min={0} max={1} step={0.05} onChange={setRestitution} />
          <div className="lab-options">
            <button type="button" className="button button--secondary button--small" onClick={() => setRunning(v => !v)}>{running ? '暂停仿真' : '运行仿真'}</button>
            <button type="button" className="button button--primary button--small" onClick={stack}>
              堆叠方块
            </button>
            <button type="button" className="button button--secondary button--small" onClick={scatter}>
              散落小球
            </button>
            <button type="button" className="button button--secondary button--small" onClick={pendulum}>
              添加单摆
            </button>
            <button type="button" className="button button--secondary button--small" onClick={clearDynamic}>
              清空
            </button>
          </div>
          <Stats>
            <Stat label="动态刚体" value={bodyCount} />
            <Stat label="正在拖拽" value={grabbed} />
          </Stats>
          <p className="lab-matter-legend">用鼠标按住任意方块或小球拖动 —— 那是 MouseConstraint 在施力，不是把坐标直接改掉。</p>
          {!motionOk ? <Status>系统开启了「减少动态效果」，仿真循环已停止；按钮生成刚体仍然可用。</Status> : null}
        </LabControls>

        <div className="lab-stage">
          <div className="lab-matter-viewport" ref={hostRef}>
            <canvas ref={canvasRef} className="lab-matter-canvas" aria-label="Matter.js 刚体仿真画布" />
          </div>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Matter.js 调用" maxHeight={340} />
    </Lab>
  );
}

/** Hand-rolled Canvas2D renderer so colours follow the active theme. */
function draw(
  ctx: CanvasRenderingContext2D,
  world: Matter.Composite,
  pendulums: Matter.Constraint[],
  palette: Palette,
  mouseConstraint: Matter.MouseConstraint | null,
  onGrab: (label: string) => void,
) {
  const p = palette;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = p.surface;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.strokeStyle = p.line;
  ctx.lineWidth = 1;
  for (let x = 0; x <= VIEW_W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW_H);
    ctx.stroke();
  }

  for (const rod of pendulums) {
    if (!rod.bodyB) continue;
    ctx.strokeStyle = p.lineStrong;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rod.pointA.x, rod.pointA.y);
    ctx.lineTo(rod.bodyB.position.x, rod.bodyB.position.y);
    ctx.stroke();
    ctx.fillStyle = p.lineStrong;
    ctx.beginPath();
    ctx.arc(rod.pointA.x, rod.pointA.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const body of Matter.Composite.allBodies(world)) {
    const x = body.position.x;
    const y = body.position.y;
    if (body.label === 'ball' || body.label === 'bob') {
      const r = body.bounds.max.x - body.bounds.min.x;
      ctx.fillStyle = body.label === 'bob' ? p.accent : p.ink;
      ctx.beginPath();
      ctx.arc(x, y, r / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (body.isStatic) {
      ctx.fillStyle = p.line;
      const w = body.bounds.max.x - body.bounds.min.x;
      const h = body.bounds.max.y - body.bounds.min.y;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = p.lineStrong;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      continue;
    }
    ctx.beginPath();
    body.vertices.forEach((v, i) => i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y));
    ctx.closePath();
    ctx.fillStyle = mouseConstraint?.body === body ? p.accent : ['#e8a27b', '#82a8d8', '#9fc6b2', '#b69ace'][body.id % 4];
    ctx.fill(); ctx.strokeStyle = p.accent; ctx.lineWidth = 2; ctx.stroke();
  }

  if (mouseConstraint?.body) onGrab(mouseConstraint.body.label);
}
