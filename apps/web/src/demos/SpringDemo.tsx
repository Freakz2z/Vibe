import { useEffect, useRef, useState } from 'react';
import { MoveUpRight, RotateCcw } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface SpringParams {
  stiffness: number;
  damping: number;
  mass: number;
}

type NumericKey = keyof SpringParams;

const DEFAULT_PARAMS: SpringParams = { stiffness: 180, damping: 14, mass: 1 };
const FIXED_STEP = 1 / 120;
const MAX_FRAME_DT = 0.1;
const PRESETS: { label: string; params: SpringParams }[] = [
  { label: '轻快', params: { stiffness: 260, damping: 20, mass: 0.7 } },
  { label: 'Q 弹', params: { stiffness: 300, damping: 8, mass: 0.9 } },
  { label: '沉稳', params: { stiffness: 90, damping: 24, mass: 1.8 } },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function SpringDemo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const positionRef = useRef({ x: 50, y: 54 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const targetPointRef = useRef({ x: 68, y: 42 });
  const paramsRef = useRef<SpringParams>(DEFAULT_PARAMS);
  const draggingRef = useRef(false);
  const reducedMotion = useReducedMotion();

  const [params, setParams] = useState<SpringParams>(DEFAULT_PARAMS);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const moveTarget = (x: number, y: number) => {
    const nextX = clamp(x, 7, 93);
    const nextY = clamp(y, 9, 91);
    targetPointRef.current = { x: nextX, y: nextY };
    if (targetRef.current) {
      targetRef.current.style.left = `${nextX}%`;
      targetRef.current.style.top = `${nextY}%`;
    }
    if (reducedMotion) {
      positionRef.current = { x: nextX, y: nextY };
      velocityRef.current = { x: 0, y: 0 };
      if (ballRef.current) {
        ballRef.current.style.left = `${nextX}%`;
        ballRef.current.style.top = `${nextY}%`;
      }
    }
  };

  const pointFromEvent = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    moveTarget(((clientX - rect.left) / rect.width) * 100, ((clientY - rect.top) / rect.height) * 100);
  };

  useEffect(() => {
    if (reducedMotion) {
      const { x, y } = targetPointRef.current;
      positionRef.current = { x, y };
      velocityRef.current = { x: 0, y: 0 };
      if (ballRef.current) {
        ballRef.current.style.left = `${x}%`;
        ballRef.current.style.top = `${y}%`;
      }
      return;
    }

    const stage = stageRef.current;
    const ball = ballRef.current;
    if (!stage || !ball) return;

    let frame = 0;
    let last = performance.now();
    let visible = true;

    const tick = (now: number) => {
      const elapsed = Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME_DT);
      last = now;
      const physics = paramsRef.current;
      const target = targetPointRef.current;
      const position = positionRef.current;
      const velocity = velocityRef.current;

      // Fixed substeps keep semi-implicit Euler stable at every slider extreme,
      // including low frame rates and the maximum damping / minimum mass.
      let remaining = elapsed;
      while (remaining > 0) {
        const step = Math.min(FIXED_STEP, remaining);
        const ax = (physics.stiffness * (target.x - position.x) - physics.damping * velocity.x) / physics.mass;
        const ay = (physics.stiffness * (target.y - position.y) - physics.damping * velocity.y) / physics.mass;

        velocity.x += ax * step;
        velocity.y += ay * step;
        position.x += velocity.x * step;
        position.y += velocity.y * step;
        remaining -= step;

        if (
          !Number.isFinite(position.x) ||
          !Number.isFinite(position.y) ||
          !Number.isFinite(velocity.x) ||
          !Number.isFinite(velocity.y)
        ) {
          position.x = target.x;
          position.y = target.y;
          velocity.x = 0;
          velocity.y = 0;
          break;
        }
      }

      ball.style.left = `${position.x}%`;
      ball.style.top = `${position.y}%`;
      frame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame || !visible || document.hidden) return;
      last = performance.now();
      frame = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible) start();
        else stop();
      },
      { threshold: 0.05 },
    );
    observer.observe(stage);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reducedMotion]);

  const changeParam = (key: NumericKey, value: number) => {
    setParams((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setParams(DEFAULT_PARAMS);
    moveTarget(68, 42);
    velocityRef.current = { x: 0, y: 0 };
  };

  const nudge = (dx: number, dy: number) => {
    const target = targetPointRef.current;
    moveTarget(target.x + dx, target.y + dy);
  };

  return (
    <section className="demo-workspace spring-demo" aria-label="弹簧参数原理演示">
      <div className="demo-toolbar">
        <div>
          <span className="demo-live-badge">可交互</span>
          <h2>拖动小球或参数，观察回弹</h2>
        </div>
        <button type="button" className="button button--quiet button--small" onClick={reset}>
          <RotateCcw size={14} aria-hidden="true" />
          重置
        </button>
      </div>

      <div className="spring-layout">
        <div
          className={`spring-stage${dragging ? ' is-dragging' : ''}`}
          ref={stageRef}
          tabIndex={0}
          role="region"
          aria-label="弹簧运动舞台。可用方向键移动目标，按下回车将目标归中。"
          onKeyDown={(event) => {
            const step = event.shiftKey ? 8 : 3;
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              nudge(-step, 0);
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              nudge(step, 0);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              nudge(0, -step);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              nudge(0, step);
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              moveTarget(50, 54);
            }
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            draggingRef.current = true;
            setDragging(true);
            pointFromEvent(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (!draggingRef.current) return;
            pointFromEvent(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            draggingRef.current = false;
            setDragging(false);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
            setDragging(false);
          }}
        >
          <span className="spring-grid" aria-hidden="true" />
          <span className="spring-target" ref={targetRef} style={{ left: '68%', top: '42%' }} aria-hidden="true">
            <i />
          </span>
          <span className="spring-ball" ref={ballRef} style={{ left: '50%', top: '54%' }} aria-hidden="true" />
          <span className="spring-hint">
            <MoveUpRight size={14} aria-hidden="true" />
            在这个区域拖动，设定新目标
          </span>
        </div>

        <div className="spring-controls">
          <div className="preset-row" aria-label="弹簧预设">
            {PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.label}
                className="filter-chip"
                onClick={() => setParams(preset.params)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="range-field" htmlFor="spring-stiffness">
            <span>
              刚度 <output htmlFor="spring-stiffness">{params.stiffness}</output>
            </span>
            <input
              id="spring-stiffness"
              type="range"
              min="40"
              max="400"
              step="10"
              value={params.stiffness}
              onChange={(event) => changeParam('stiffness', Number(event.target.value))}
            />
            <small>越大，回正越快</small>
          </label>

          <label className="range-field" htmlFor="spring-damping">
            <span>
              阻尼 <output htmlFor="spring-damping">{params.damping}</output>
            </span>
            <input
              id="spring-damping"
              type="range"
              min="3"
              max="40"
              step="1"
              value={params.damping}
              onChange={(event) => changeParam('damping', Number(event.target.value))}
            />
            <small>越大，回弹越收敛</small>
          </label>

          <label className="range-field" htmlFor="spring-mass">
            <span>
              质量 <output htmlFor="spring-mass">{params.mass.toFixed(1)}</output>
            </span>
            <input
              id="spring-mass"
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={params.mass}
              onChange={(event) => changeParam('mass', Number(event.target.value))}
            />
            <small>越大，惯性越明显</small>
          </label>

          <p className="demo-caption">
            {reducedMotion
              ? '系统已开启减少动态效果，小球会直接到达目标位置。'
              : '舞台聚焦后也可用方向键微调目标，按 Enter 归中。动画在离开视口时会暂停。'}
          </p>
        </div>
      </div>
    </section>
  );
}
