import { LabControls } from '../lab-kit';
import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Segmented, Status, useMotionOk } from '../lab-kit';

type Mode = 'layout' | 'reveal' | 'drag';

const MODES: readonly (readonly [Mode, string])[] = [
  ['layout', 'layoutId 共享元素'],
  ['reveal', 'AnimatePresence 退场'],
  ['drag', 'drag 手势'],
];

interface Item {
  id: string;
  name: string;
  note: string;
  mix: number;
}

const ITEMS: readonly Item[] = [
  { id: 'a', name: '版式共享', note: '徽标飞入详情槽', mix: 18 },
  { id: 'b', name: '标签切换', note: '指示条在标签间滑动', mix: 30 },
  { id: 'c', name: '网格切换', note: '卡片整体重排', mix: 42 },
  { id: 'd', name: '列表搬运', note: '跨容器布局过渡', mix: 54 },
  { id: 'e', name: '抽屉展开', note: '尺寸同步补间', mix: 66 },
  { id: 'f', name: '回弹定位', note: 'spring 收尾', mix: 78 },
];

/** Motion（motion/react）：真实的 layoutId 共享元素 FLIP，外加 AnimatePresence 与拖拽。 */
export default function MotionLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const [mode, setMode] = useState<Mode>('layout');
  const [activeId, setActiveId] = useState<string | null>('b');
  const [dots, setDots] = useState<string[]>(() => ITEMS.map((i) => i.id));
  const dragBoxRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => ITEMS.find((i) => i.id === activeId) ?? null, [activeId]);
  const dur = motionOk ? 0.42 : 0;

  const snippet = useMemo(
    () =>
      [
        `import { AnimatePresence, motion } from 'motion/react';`,
        '',
        `// 标签与徽标使用同一个 layoutId，React 换挂载点时 Motion 自动做 FLIP`,
        activeId
          ? ['{ITEMS.map(item => (', '  <button key={item.id} onClick={...}>', '    {item.name}', '    {active && <motion.span layoutId="lab-motion-card" className="lab-motion-badge" />}', '  </button>', '))}'].join('\n')
          : '// 当前没有选中项：徽标不在任何卡片里',
        '',
        `// 详情槽里是同一个 layoutId，徽标会从卡片“长”成大面板`,
        `{active && <motion.div layoutId="lab-motion-card" className="lab-motion-detail" />}`,
        '',
        `// 退场动画：AnimatePresence 接管被移除的节点`,
        `<AnimatePresence mode="popLayout">`,
        `  {dots.map((id) => <motion.div key={id} exit={{ opacity: 0, scale: 0.4 }} />)}`,
        `</AnimatePresence>`,
        '',
        `// 手势：drag 是真实的指针事件驱动的弹簧动画`,
        `<motion.div drag dragConstraints={boxRef} dragElastic={0.25} />`,
      ].join('\n'),
    [activeId],
  );

  const reset = () => {
    setActiveId('b');
    setDots(ITEMS.map((i) => i.id));
  };

  return (
    <Lab title="Motion 布局过渡" badge={<span className="demo-live-badge">motion/react 12</span>} reset={reset}>
      <div className="lab-layout">
        <LabControls className="lab-controls">
          <Segmented<Mode> label="演示能力" value={mode} options={MODES} onChange={setMode} />
          <div className="lab-options">
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => setActiveId((id) => (id === null ? 'a' : id === 'a' ? null : 'a'))}
            >
              切换选中 / 取消选中
            </button>
          </div>
          <p className="lab-motion-note">
            当前选中：<strong>{active ? active.name : '（无）'}</strong>。先选中一项再切换另一项，可以看到同一个 layoutId 在不同挂载点之间被 Motion 接住。
          </p>
          {!motionOk ? <Status>系统开启了「减少动态效果」，过渡时长已降为 0。共享元素的落点仍然正确。</Status> : null}
        </LabControls>

        <div className="lab-stage">
          {mode === 'layout' ? (
            <>
              <div className="lab-motion-tray">
                {active ? (
                  <motion.div
                    layoutId="lab-motion-card"
                    className="lab-motion-badge"
                    style={{ position: 'static', width: 64, height: 64, borderRadius: 18 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30, duration: dur }}
                  />
                ) : (
                  <span className="lab-motion-tray__label">详情槽为空 —— 点击任意卡片，徽标会从卡片飞到槽位里</span>
                )}
                {active ? (
                  <motion.span
                    key={active.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: dur, delay: motionOk ? 0.12 : 0 }}
                    className="lab-motion-tray__label"
                  >
                    {active.name} · {active.note}
                  </motion.span>
                ) : null}
              </div>

              <div className="lab-motion-grid">
                {ITEMS.map((item) => {
                  const isActive = item.id === activeId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="lab-motion-card"
                      data-active={isActive}
                      aria-pressed={isActive}
                      onClick={() => setActiveId((id) => (id === item.id ? null : item.id))}
                    >
                      <span
                        className="lab-motion-card__swatch"
                        style={{ background: `color-mix(in srgb, var(--accent) ${item.mix}%, var(--surface))` }}
                      />
                      <strong>{item.name}</strong>
                      <small>{item.note}</small>
                      {isActive ? <motion.span layoutId="lab-motion-card" className="lab-motion-badge" transition={{ duration: dur }} /> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {mode === 'reveal' ? (
            <>
              <div className="lab-options">
                <button type="button" className="button button--primary button--small" onClick={() => setDots(ITEMS.map((i) => i.id))}>
                  全部恢复
                </button>
                <button type="button" className="button button--secondary button--small" onClick={() => setDots((d) => (d.length > 1 ? d.slice(1) : d))}>
                  移除第一个
                </button>
                <button type="button" className="button button--secondary button--small" onClick={() => setDots((d) => d.slice(0, -1))}>
                  移除最后一个
                </button>
              </div>
              <div className="lab-motion-reveal">
                <AnimatePresence mode="popLayout" initial={false}>
                  {dots.map((id, i) => {
                    const item = ITEMS.find((x) => x.id === id);
                    if (!item) return null;
                    return (
                      <motion.div
                        key={id}
                        layout
                        className="lab-motion-dot"
                        style={{ background: `color-mix(in srgb, var(--accent) ${item.mix}%, var(--surface))` }}
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.4, transition: { duration: dur } }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28, duration: dur }}
                      >
                        <span aria-hidden="true">{i + 1}</span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
              <p className="lab-motion-note">剩余 {dots.length} 个方块。移除时由 AnimatePresence 接管退场动画，`layout` 让其余方块自动补位。</p>
            </>
          ) : null}

          {mode === 'drag' ? (
            <div className="lab-motion-drag" ref={dragBoxRef}>
              <motion.div
                drag
                dragConstraints={dragBoxRef}
                dragElastic={0.25}
                dragMomentum={false}
                whileDrag={{ cursor: 'grabbing' }}
                className="lab-motion-dot"
                style={{ width: 54, height: 54, background: 'var(--accent)', touchAction: 'none' }}
              >
                <span aria-hidden="true">拖</span>
              </motion.div>
            </div>
          ) : null}
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Motion 调用" maxHeight={300} />
    </Lab>
  );
}
