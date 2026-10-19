import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

export function ParticlesDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [density, setDensity] = useState(76);
  const [seed, setSeed] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let visible = true;
    let disposed = false;
    const pointer = { x: 0, y: 0, active: false, strength: 1 };
    const accent =
      window.getComputedStyle(canvas).getPropertyValue('--particle-color').trim() || '#e86448';

    const buildParticles = () => {
      particles = Array.from({ length: density }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        size: 0.9 + Math.random() * 2.1,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const paint = () => {
      context.clearRect(0, 0, width, height);

      if (pointer.active) {
        context.save();
        context.globalAlpha = 0.06;
        context.fillStyle = accent;
        context.beginPath();
        context.arc(pointer.x, pointer.y, 120, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.18;
        context.beginPath();
        context.arc(pointer.x, pointer.y, 3.5, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      context.strokeStyle = accent;
      context.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i += 1) {
        const first = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const second = particles[j];
          const dx = first.x - second.x;
          const dy = first.y - second.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > 4900) continue;
          context.globalAlpha = 0.13 * (1 - Math.sqrt(distanceSquared) / 70);
          context.beginPath();
          context.moveTo(first.x, first.y);
          context.lineTo(second.x, second.y);
          context.stroke();
        }
      }

      context.fillStyle = accent;
      for (const particle of particles) {
        context.globalAlpha = 0.35 + particle.size * 0.16;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const tick = (time: number) => {
      for (const particle of particles) {
        if (pointer.active) {
          const dx = pointer.x - particle.x;
          const dy = pointer.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy) + 1;
          if (distance < 190) {
            const pull = (1 - distance / 190) * 0.05 * pointer.strength;
            particle.vx += (dx / distance) * pull;
            particle.vy += (dy / distance) * pull;
          }
        }

        particle.vx += Math.cos(time * 0.00045 + particle.phase) * 0.0022;
        particle.vy += Math.sin(time * 0.00038 + particle.phase) * 0.0022;
        particle.vx *= 0.975;
        particle.vy *= 0.975;
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;
      }

      paint();
      if (!disposed && visible && !document.hidden) {
        frame = window.requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const start = () => {
      if (frame || reducedMotion || disposed || !visible || document.hidden) return;
      frame = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
      if (reducedMotion) paint();
    };

    const updatePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };
    const onPointerDown = (event: PointerEvent) => {
      pointer.strength = 2.2;
      updatePointer(event);
    };
    const onPointerUp = () => {
      pointer.strength = 1;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!reducedMotion) paint();
    });
    resizeObserver.observe(canvas);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible) start();
        else stop();
      },
      { threshold: 0.05 },
    );
    visibilityObserver.observe(stage);

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!reducedMotion) {
      canvas.addEventListener('pointermove', updatePointer);
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointerleave', onPointerLeave);
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    resize();
    if (reducedMotion) paint();
    else start();

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('pointermove', updatePointer);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [density, reducedMotion, seed]);

  return (
    <section className="demo-workspace particles-demo" aria-label="Canvas 粒子吸引原理演示">
      <div className="demo-toolbar">
        <div>
          <span className="demo-live-badge">Canvas</span>
          <h2>让一群点跟着指针流动</h2>
        </div>
        <button
          type="button"
          className="button button--quiet button--small"
          onClick={() => setSeed((value) => value + 1)}
        >
          <RotateCcw size={14} aria-hidden="true" />
          重新播撒
        </button>
      </div>

      <div className="particles-layout">
        <div className="particles-stage" ref={stageRef}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="可交互的粒子场。移动指针会吸引附近粒子，按下可增强吸引。粒子数量和运动状态由右侧控件调整。"
          >
            粒子场需要支持 Canvas 的浏览器。
          </canvas>
          <div className="particles-overlay">
            <span>移动指针 · 形成吸引场</span>
            <span>{density} 个粒子</span>
          </div>
        </div>

        <div className="particles-controls">
          <label className="range-field" htmlFor="particle-density">
            <span>
              粒子密度 <output htmlFor="particle-density">{density}</output>
            </span>
            <input
              id="particle-density"
              type="range"
              min="24"
              max="160"
              step="4"
              value={density}
              onChange={(event) => setDensity(Number(event.target.value))}
            />
            <small>在 24 到 160 个点之间调整。</small>
          </label>

          <ul className="particles-notes">
            <li>指针附近的点会被吸引，离开后逐步散开。</li>
            <li>Canvas 在离开视口或页面隐藏时暂停。</li>
            <li>线条用来显示邻近关系，不表示真实网络。</li>
          </ul>

          <p className="demo-caption">
            {reducedMotion
              ? '系统已开启减少动态效果：粒子场保持静态，控件仍可调整密度。'
              : '画面完全由 Canvas 实时绘制，离开这个页面时会停止动画并释放监听器。'}
          </p>
        </div>
      </div>
    </section>
  );
}
