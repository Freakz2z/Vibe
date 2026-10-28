import { Code, LabControls } from '../lab-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import type { DemoCopyHandler } from '../types';
import { Lab, Range, Select, Status, useMotionOk, useThemeColors } from '../lab-kit';

gsap.registerPlugin(Draggable, MotionPathPlugin);

type Ease = 'power1.inOut' | 'power2.in' | 'back.out(1.6)' | 'elastic.out(1, 0.4)' | 'none';

const EASES: readonly (readonly [Ease, string])[] = [
  ['none', '线性'],
  ['power1.inOut', 'power1.inOut'],
  ['power2.in', 'power2.in'],
  ['back.out(1.6)', 'back.out'],
  ['elastic.out(1, 0.4)', 'elastic.out'],
];

interface Step {
  id: string;
  label: string;
  detail: string;
}

const STEPS: Step[] = [
  { id: 'enter', label: '卡片进场', detail: '面板错位落下' },
  { id: 'orbit', label: '沿路径运动', detail: 'MotionPathPlugin 走弧线' },
  { id: 'spin', label: '自转与缩放', detail: 'rotation + scale' },
  { id: 'settle', label: '收尾定格', detail: '回到初始状态' },
];

/**
 * GSAP: one real paused timeline, a Draggable playhead that scrubs it, and
 * tl.reverse() for real reverse playback.
 *
 * Coordinate system: GSAP owns the playhead's x position inside the scrub
 * track. React never writes `left` on the same element, so there is exactly
 * one source of truth. Readouts are normalised to 0..1 progress.
 */
export default function GsapLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const colors = useThemeColors();

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const orbPathRef = useRef<SVGPathElement>(null);
  const playheadRef = useRef<HTMLButtonElement>(null);
  const scrubTrackRef = useRef<HTMLDivElement>(null);

  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const dragRef = useRef<Draggable | null>(null);
  const actualDurationRef = useRef(4);

  const [targetDuration, setTargetDuration] = useState(4);
  const [repeat, setRepeat] = useState(0);
  const [ease, setEase] = useState<Ease>('power1.inOut');
  const [progress, setProgress] = useState(0);
  const [actualDuration, setActualDuration] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'reversed'>('forward');
  const [nonce, setNonce] = useState(0);

  const setPlayheadX = useCallback((ratio: number) => {
    const track = scrubTrackRef.current;
    const playhead = playheadRef.current;
    if (!track || !playhead) return;
    const width = track.clientWidth;
    if (width <= 0) return;
    gsap.set(playhead, { x: Math.max(0, Math.min(width, ratio * width)) });
  }, []);

  // Build the timeline inside a scoped context so no global selector leaks.
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const orbPath = orbPathRef.current;
    const playhead = playheadRef.current;
    const scrubTrack = scrubTrackRef.current;
    if (!root || !track || !orbPath || !playhead || !scrubTrack) return;

    const ctx = gsap.context(() => {
      gsap.set(track.querySelectorAll('.gsap-card'), { opacity: 0, y: 18 });
      gsap.set('.gsap-orb', { xPercent: -50, yPercent: -50, scale: 1, rotation: 0, opacity: 1 });

      const tl = gsap.timeline({
        paused: true,
        defaults: { ease },
        repeat,
        onUpdate(this: gsap.core.Timeline) {
          const ratio = this.progress();
          setProgress(ratio);
          setPlayheadX(ratio);
        },
        onComplete() {
          setPlaying(false);
        },
        onReverseComplete() {
          setPlaying(false);
        },
        onRepeat(this: gsap.core.Timeline) {
          setDirection(this.reversed() ? 'reversed' : 'forward');
        },
      });

      tl.to(track.querySelectorAll('.gsap-card'), { opacity: 1, y: 0, stagger: 0.12, duration: targetDuration * 0.35 })
        .to(
          '.gsap-orb',
          {
            motionPath: { path: orbPath, align: orbPath, alignOrigin: [0.5, 0.5], autoRotate: true },
            duration: targetDuration * 0.3,
          },
          '-=0.1',
        )
        .to('.gsap-orb', { rotation: '+=540', scale: 1.35, duration: targetDuration * 0.18, ease: 'none' })
        .to('.gsap-orb', { scale: 1, rotation: '+=180', duration: targetDuration * 0.17 });

      // Normalise the timeline to exactly the requested total duration: the
      // stagger and the "-=0.1" overlap otherwise inflate the real length.
      tl.duration(targetDuration);

      actualDurationRef.current = tl.duration() / tl.timeScale();
      setActualDuration(tl.duration() / tl.timeScale());
      timelineRef.current = tl;

      // Playhead drags inside its own scrub track, bounded to that track.
      dragRef.current = Draggable.create(playhead, {
        type: 'x',
        trigger: scrubTrack,
        allowContextMenu: false,
        bounds: scrubTrack,
        inertia: false,
        onPress() {
          tl.pause();
          setPlaying(false);
        },
        onDrag() {
          const width = scrubTrack.clientWidth;
          if (width <= 0) return;
          const ratio = Math.max(0, Math.min(1, this.x / width));
          tl.progress(ratio);
          setProgress(ratio);
        },
      })[0];
    }, root);

    setPlayheadX(0);
    setProgress(0);
    setDirection('forward');
    setPlaying(false);

    return () => {
      ctx.revert();
      dragRef.current = null;
      timelineRef.current = null;
    };
  }, [targetDuration, ease, repeat, nonce, setPlayheadX]);

  // Keep the playhead aligned when the viewport resizes.
  useEffect(() => {
    const onResize = () => setPlayheadX(timelineRef.current?.progress() ?? 0);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setPlayheadX]);

  // Autoplay is driven by tl.reverse()/tl.play(), never re-issuing play().
  useEffect(() => {
    if (!playing) return;
    const tl = timelineRef.current;
    if (!tl) {
      setPlaying(false);
      return;
    }
    if (direction === 'reversed') tl.reverse();
    else tl.play();
  }, [playing, direction, nonce]);

  // Pause if the OS asks for reduced motion while running.
  useEffect(() => {
    if (motionOk) return;
    timelineRef.current?.pause();
    setPlaying(false);
  }, [motionOk]);

  const toggle = useCallback(() => {
    const tl = timelineRef.current;
    if (!tl) return;
    if (playing) {
      tl.pause();
      setPlaying(false);
      return;
    }
    // Restarting from the end plays forward again.
    if (tl.progress() >= 1 && direction === 'forward') tl.progress(0);
    setDirection('forward');
    setPlaying(true);
  }, [playing, direction]);

  const toggleDirection = useCallback(() => {
    const tl = timelineRef.current;
    if (!tl) return;
    const next = direction === 'forward' ? 'reversed' : 'forward';
    setDirection(next);
    setPlaying(true);
  }, [direction]);

  // Changing timeline parameters always leaves the demo paused at the start.
  const retime = useCallback((apply: () => void) => {
    timelineRef.current?.pause();
    setPlaying(false);
    apply();
    setNonce((n) => n + 1);
  }, []);

  const reset = useCallback(() => {
    const tl = timelineRef.current;
    tl?.pause();
    tl?.progress(0);
    setTargetDuration(4);
    setRepeat(0);
    setEase('power1.inOut');
    setProgress(0);
    setDirection('forward');
    setPlaying(false);
    setPlayheadX(0);
    setNonce((n) => n + 1);
  }, [setPlayheadX]);

  const scrubByKeyboard = useCallback(
    (delta: number) => {
      const tl = timelineRef.current;
      if (!tl) return;
      tl.pause();
      setPlaying(false);
      const next = Math.max(0, Math.min(1, tl.progress() + delta));
      tl.progress(next);
      setProgress(next);
      setPlayheadX(next);
    },
    [setPlayheadX],
  );

  const activeStep = useMemo(() => {
    if (progress < 0.12) return STEPS[0];
    if (progress < 0.45) return STEPS[1];
    if (progress < 0.78) return STEPS[2];
    return STEPS[3];
  }, [progress]);

  const snippet = useMemo(
    () =>
      [
        `const ctx = gsap.context(() => {`,
        `  const tl = gsap.timeline({ paused: true, defaults: { ease: '${ease}' }, repeat: ${repeat} });`,
        `  tl.to('.card', { opacity: 1, y: 0, stagger: 0.12, duration: ${(targetDuration * 0.35).toFixed(2)} })`,
        `    .to('.orb', { motionPath: { path: orbPath, align: orbPath, autoRotate: true }, duration: ${(targetDuration * 0.3).toFixed(2)} }, '-=0.1')`,
        `    .to('.orb', { rotation: '+=540', scale: 1.35, duration: ${(targetDuration * 0.18).toFixed(2)} })`,
        `    .to('.orb', { scale: 1, rotation: '+=180', duration: ${(targetDuration * 0.17).toFixed(2)} });`,
        `  // 把真实总时长规范到目标值（stagger 与重叠会改变长度）`,
        `  tl.duration(${targetDuration});`,
        ``,
        `  Draggable.create(playhead, { type: 'x', trigger: scrubTrack, bounds: scrubTrack,`,
        `    onDrag() { tl.progress(this.x / scrubTrack.clientWidth); } });`,
        `});`,
        ``,
        `// 倒放由时间轴自身完成`,
        `tl.reverse();`,
      ].join('\n'),
    [ease, repeat, targetDuration],
  );

  const accent = colors.accent ?? '#e2725b';
  const line = colors['line-strong'] ?? '#cfc4bb';

  return (
    <Lab
      title="GSAP 时间轴编排"
      badge={<span className="demo-live-badge">GSAP {gsap.version}</span>}
      reset={reset}
    >
      <div ref={rootRef}>
        <div className="lab-layout">
          <LabControls className="lab-controls">
            <Range
              label="目标总时长"
              value={targetDuration}
              min={2}
              max={10}
              step={1}
              unit=" 秒"
              onChange={(value) => retime(() => setTargetDuration(value))}
              hint="改动会重建时间轴并暂停在起点。"
            />
            <Range
              label="循环次数"
              value={repeat}
              min={0}
              max={3}
              step={1}
              unit=" 次"
              onChange={(value) => retime(() => setRepeat(value))}
              hint="0 为播完停止。"
            />
            <Select<Ease>
              label="缓动"
              value={ease}
              options={EASES}
              onChange={(value) => retime(() => setEase(value))}
            />
            <div className="lab-options">
              <button type="button" className="button button--primary button--small" onClick={toggle}>
                {playing ? '暂停' : '播放'}
              </button>
              <button type="button" className="button button--secondary button--small" onClick={toggleDirection}>
                {direction === 'forward' ? '倒放' : '正放'}
              </button>
            </div>
            {motionOk ? null : (
              <Status>系统开启了「减少动态效果」，已暂停自动播放；仍可手动点击播放或拖动播放头。</Status>
            )}
          </LabControls>

          <div className="lab-stage">
            <div className="lab-timeline-track" ref={trackRef}>
              {[0, 1, 2, 3].map((i) => (
                <div className="gsap-card" key={i} style={i === 1 ? { borderColor: accent } : undefined}>
                  <strong>#{i + 1}</strong>
                  <span>{['输入', '渲染', '提交', '完成'][i]}</span>
                </div>
              ))}
              <svg className="gsap-path" viewBox="0 0 200 120" aria-hidden="true" preserveAspectRatio="none">
                <path ref={orbPathRef} d="M20 100 C 60 10, 140 110, 180 20" fill="none" stroke={line} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="gsap-orb" style={{ background: accent }} aria-hidden="true" />
            </div>

            <div className="lab-scrub">
              <span className="lab-scrub__time">
                {(progress * actualDuration).toFixed(2)}s / {actualDuration.toFixed(2)}s
              </span>
              <div className="lab-scrub__track" ref={scrubTrackRef}>
                <button
                  type="button"
                  ref={playheadRef}
                  className="lab-scrub__head"
                  style={{ background: accent }}
                  aria-label="拖动播放头"
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  aria-valuetext={`${(progress * actualDuration).toFixed(2)} 秒`}
                  onKeyDown={(event) => {
                    const stepSize = event.shiftKey ? 0.1 : 0.02;
                    if (event.key === 'ArrowRight') {
                      event.preventDefault();
                      scrubByKeyboard(stepSize);
                    } else if (event.key === 'ArrowLeft') {
                      event.preventDefault();
                      scrubByKeyboard(-stepSize);
                    } else if (event.key === 'Home') {
                      event.preventDefault();
                      scrubByKeyboard(-1);
                    } else if (event.key === 'End') {
                      event.preventDefault();
                      scrubByKeyboard(1);
                    }
                  }}
                />
              </div>
              <span className="lab-scrub__step">
                {activeStep.label} · {activeStep.detail}
                {direction === 'reversed' ? ' · 倒放中' : ''}
              </span>
            </div>
          </div>
        </div>

        <ul className="lab-steps">
          {STEPS.map((step, i) => (
            <li key={step.id} data-active={step.id === activeStep.id}>
              <span>{i + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            </li>
          ))}
        </ul>

        <Code text={snippet} onCopy={onCopy} label="GSAP 调用" maxHeight={280}/>
      </div>
    </Lab>
  );
}
