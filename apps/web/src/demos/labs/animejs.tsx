import { LabControls } from '../lab-kit';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createTimeline, stagger, svg } from 'animejs';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Range, Status, useMotionOk } from '../lab-kit';

const CELLS = 8;

/** Anime.js v4：createTimeline + svg.morphTo + stagger + 属性动画，全部走 v4 新 API。 */
export default function AnimejsLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const morphRef = useRef<SVGPathElement>(null);
  const morphTargetRef = useRef<SVGPathElement>(null);
  const drawRef = useRef<SVGPolylineElement>(null);
  const attrRef = useRef<SVGCircleElement>(null);
  const cellsRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<ReturnType<typeof createTimeline> | null>(null);

  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const morph = morphRef.current;
    const target = morphTargetRef.current;
    const draw = drawRef.current;
    const attr = attrRef.current;
    const cells = cellsRef.current;
    if (!morph || !target || !draw || !attr || !cells) return;

    // svg.createDrawable measures the geometry and reports its length back.
    const [drawable] = svg.createDrawable(draw);
    const drawables = [drawable];

    const tl = createTimeline({
      defaults: { ease: 'inOutQuad' },
      onUpdate: (self) => setTime(Math.round(self.currentTime)),
      onComplete: () => setPaused(true),
      onPause: () => setPaused(true),
    });

    // 1) SVG transform attributes: v4 writes translate/rotate onto the element.
    tl.add(attr, { translateX: 350, translateY: -46, scale: 1.35, duration: 900, ease: 'outQuad' }, 0);

    // 2) Path morphing: svg.morphTo returns a function value Paper.js resolves per frame.
    tl.add(morph, { d: svg.morphTo(target), duration: 1200 }, 150);

    // 3) Real stroke drawing: svg.createDrawable turns the path into drawable geometry,
    //    then the `draw` property ('0 0 1' -> '0 1 1') writes stroke-dasharray/offset.
    tl.add(drawables, { draw: ['0 0 1', '0 1 1'], duration: 1100, ease: 'inOutQuad' }, 200);

    // 4) Stagger across eight DOM nodes.
    tl.add(Array.from(cells.children), { scale: [0.35, 1], opacity: [0.2, 1], duration: 600, delay: stagger(80) }, 300);

    // 5) Rotation on the drawn path — transform-origin follows the geometry.
    tl.add(draw, { rotate: '+=8deg', duration: 900, ease: 'inOutSine' }, 900);

    tl.speed = speed;
    setDuration(tl.duration);

    if (!motionOk) {
      // Reduced motion: land on the final state without playing anything.
      tl.pause();
      tl.seek(tl.duration);
    } else {
      tl.pause();
      tl.seek(0);
    }
    setPaused(true);

    tlRef.current = tl;
    return () => {
      tl.pause();
      tl.revert();
      tlRef.current = null;
    };
  }, [motionOk, nonce]);

  useEffect(() => {
    const tl = tlRef.current;
    if (tl) tl.speed = speed;
  }, [speed]);

  const snippet = useMemo(
    () =>
      [
        `// Anime.js v4：新 API，没有 v3 的全局 anime({...})`,
        `import { createTimeline, stagger, svg } from 'animejs';`,
        ``,
        `const tl = createTimeline({ defaults: { ease: 'inOutQuad' }, onUpdate: (self) => setTime(self.currentTime) });`,
        ``,
        `// 1) SVG 变换：v4 直接写 translate / scale / rotate`,
        `tl.add(circle, { translateX: 350, translateY: -46, scale: 1.35, duration: 900 }, 0);`,
        ``,
        `// 2) 路径 d 变形：svg.morphTo 返回一个逐帧求值的函数值`,
        `tl.add(morphPath, { d: svg.morphTo(targetPath), duration: 1200 }, 150);`,
        ``,
        `// 3) 描边绘制：createDrawable 量出几何长度，draw 属性驱动 dasharray/offset`,
        `const [drawable] = svg.createDrawable(polyline);`,
        `tl.add([drawable], { draw: ['0 0 1', '0 1 1'], duration: 1100 }, 200);`,
        ``,
        `// 4) 错峰：stagger 给每个子节点递增延迟`,
        `tl.add(cells, { scale: [0.35, 1], opacity: [0.2, 1], delay: stagger(80) }, 300);`,
        ``,
        `// 控制`,
        `tl.play(); tl.pause(); tl.reverse(); tl.seek(0); tl.speed = ${speed};`,
        ``,
        `// 卸载：revert() 会撤销 inline 样式并移除 CSS/attribute 上的插值`,
        `tl.pause(); tl.revert();`,
      ].join('\n'),
    [speed],
  );

  const progress = duration > 0 ? Math.min(1, time / duration) : 0;

  return (
    <Lab
      title="Anime.js v4 时间轴"
      badge={<span className="demo-live-badge">animejs 4.0.2</span>}
      reset={() => {
        setSpeed(1);
        setNonce((n) => n + 1);
      }}
    >
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <Range label="播放速度" value={speed} min={0.25} max={3} step={0.25} unit=" 倍" onChange={setSpeed} />
          <div className="lab-options">
            <button
              type="button"
              className="button button--primary button--small"
              onClick={() => {
                const tl = tlRef.current;
                if (!tl) return;
                if (paused) {
                  tl.play();
                  setPaused(false);
                } else {
                  tl.pause();
                  setPaused(true);
                }
              }}
            >
              {paused ? '播放' : '暂停'}
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const tl = tlRef.current;
                if (!tl) return;
                tl.restart();
                tl.play();
              }}
            >
              重播
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                const tl = tlRef.current;
                if (!tl) return;
                tl.reverse();
                tl.play();
              }}
            >
              倒放
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                tlRef.current?.seek(0);
                tlRef.current?.pause();
                setTime(0);
              }}
            >
              回到开头
            </button>
          </div>
          <p className="lab-motion-note">
            当前时间 {time} ms / {duration} ms（{Math.round(progress * 100)}%），读自 Anime.js 的 <code>onUpdate</code>。
          </p>
          {!motionOk ? <Status>系统开启了「减少动态效果」，时间轴直接停在终态，不播放动画。</Status> : null}
        </LabControls>

        <div className="lab-stage">
          <svg className="lab-anime-svg" viewBox="0 0 520 220" role="img" aria-label="路径变形与描边绘制动画">
            <path ref={morphTargetRef} d="M40 170 L120 170 L160 60 L240 60 L280 170 L360 170 L400 60 L480 60" fill="none" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="5 6" />
            <path ref={morphRef} d="M40 60 L120 60 L160 170 L240 170 L280 60 L360 60 L400 170 L480 170" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <polyline ref={drawRef} points="60,205 110,180 160,205 210,180 260,205 310,180 360,205 410,180 460,205" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            <circle ref={attrRef} cx="80" cy="80" r="18" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
          </svg>

          <div className="lab-anime-row" ref={cellsRef}>
            {Array.from({ length: CELLS }, (_, i) => (
              <div
                key={i}
                className="lab-anime-cell"
                style={{ background: `color-mix(in srgb, var(--accent) ${12 + i * 10}%, var(--surface))` }}
              />
            ))}
          </div>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Anime.js v4 调用" maxHeight={360} />
    </Lab>
  );
}
