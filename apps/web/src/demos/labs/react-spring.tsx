import { LabControls } from '../lab-kit';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { animated, useSpring, useSprings } from '@react-spring/web';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Range, Status, useMotionOk } from '../lab-kit';

const TILE_COUNT = 8;

interface BallProps {
  tension: number;
  friction: number;
  motionOk: boolean;
}

function Ball({ tension, friction, motionOk }: BallProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(40);
  useEffect(() => {
    const ball = ref.current, track = ball?.parentElement;
    if (!ball || !track) return;
    const measure = () => setDistance(Math.max(0, Math.min(90, (track.clientWidth - ball.offsetWidth) / 2 - 8)));
    const observer = new ResizeObserver(measure); observer.observe(track); measure();
    return () => observer.disconnect();
  }, []);
  const [style, api] = useSpring({
    from: { x: -distance, scale: 0.72, rotate: -18 },
    to: { x: 0, scale: 1, rotate: 0 },
    config: { tension, friction },
    immediate: !motionOk,
  }, [tension, friction, motionOk, distance]);

  const replay = () => {
    void api.start({
      from: { x: -distance, scale: 0.72, rotate: -18 },
      to: { x: 0, scale: 1, rotate: 0 },
      reset: true,
      config: { tension, friction },
      immediate: !motionOk,
    });
  };

  return (
    <animated.div
      ref={ref}
      className="lab-spring-ball"
      style={style as unknown as CSSProperties}
      onClick={replay}
      role="button"
      tabIndex={0}
      aria-label="点击重新播放弹簧动画"
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          replay();
        }
      }}
    >
      弹簧
    </animated.div>
  );
}

/** React Spring（@react-spring/web）：真实阻尼弹簧积分，useSpring + useSprings 错峰入场。 */
export default function ReactSpringLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const [tension, setTension] = useState(180);
  const [friction, setFriction] = useState(12);
  const [nonce, setNonce] = useState(0);

  // useSprings(count, fn) 永远返回 [values, api] 元组（fn 形式必定创建 ref），
  // 直接把返回值当数组 map 会把 SpringValues[] 本身当成一个 style 传给 DOM。
  const [tiles] = useSprings(TILE_COUNT, (i) => ({
    from: { opacity: 0, y: 44, scale: 0.6 },
    to: { opacity: 1, y: 0, scale: 1 },
    config: { tension, friction },
    delay: motionOk ? i * 55 : 0,
    immediate: !motionOk,
    reset: true,
  }), [tension, friction, motionOk, nonce]);

  const snippet = useMemo(
    () =>
      [
        `import { animated, useSpring, useSprings } from '@react-spring/web';`,
        '',
        `// 单个弹簧：from -> to，config 直接决定阻尼曲线`,
        `const [style, api] = useSpring({`,
        `  from: { x: -distance, scale: 0.72, rotate: -18 },`,
        `  to:   { x: 0, scale: 1, rotate: 0 },`,
        `  config: { tension: ${tension}, friction: ${friction} },`,
        `});`,
        ``,
        `// 用 <animated.div {...style}> 提交，react-spring 自己持有并回收 RAF 循环`,
        `<animated.div className="lab-spring-ball" style={style} />`,
        ``,
        `// 8 个弹簧错峰入场：delay 由索引给出（fn 形式返回 [values, api]，要解构）`,
        `const [tiles] = useSprings(${TILE_COUNT}, (i) => ({`,
        `  from: { opacity: 0, y: 44, scale: 0.6 },`,
        `  to:   { opacity: 1, y: 0,   scale: 1 },`,
        `  config: { tension: ${tension}, friction: ${friction} },`,
        `  delay: i * 55,`,
        `}));`,
      ].join('\n'),
    [friction, tension],
  );

  return (
    <Lab
      title="React Spring 阻尼弹簧"
      badge={<span className="demo-live-badge">@react-spring/web 9</span>}
      reset={() => {
        setTension(180);
        setFriction(12);
        setNonce((n) => n + 1);
      }}
    >
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <Range
            label="张力 tension"
            value={tension}
            min={20}
            max={600}
            step={10}
            onChange={(v) => {
              setTension(v);
              setNonce((n) => n + 1);
            }}
            hint="越大越“绷”，回弹更急。"
          />
          <Range
            label="摩擦 friction"
            value={friction}
            min={2}
            max={60}
            step={1}
            onChange={(v) => {
              setFriction(v);
              setNonce((n) => n + 1);
            }}
            hint="越大越“黏”，越不容易过冲。"
          />
          <div className="lab-options">
            <button type="button" className="button button--primary button--small" onClick={() => setNonce((n) => n + 1)}>
              重放全部
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                setTension(600);
                setFriction(6);
                setNonce((n) => n + 1);
              }}
            >
              高弹性
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                setTension(40);
                setFriction(50);
                setNonce((n) => n + 1);
              }}
            >
              高阻尼
            </button>
          </div>
          {!motionOk ? <Status>系统开启了「减少动态效果」，弹簧改为 immediate 直达终态。</Status> : null}
        </LabControls>

        <div className="lab-stage">
          <div className="lab-spring-grid">
            {tiles.map((style, i) => (
              <animated.div key={`${nonce}-${i}`} className="lab-spring-tile" style={style as unknown as CSSProperties}>
                #{i + 1}
              </animated.div>
            ))}
          </div>

          <div className="lab-spring-track">
            <Ball key={`ball-${nonce}`} tension={tension} friction={friction} motionOk={motionOk} />
          </div>
          <p className="lab-motion-note">点圆球或按 Enter 会重新触发一次弹簧（config 仍是当前的 tension/friction）。</p>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="React Spring 调用" maxHeight={320} />
    </Lab>
  );
}
