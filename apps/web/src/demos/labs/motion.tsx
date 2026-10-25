import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useMotionValueEvent } from 'motion/react';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Segmented, Status, useMotionOk } from '../lab-kit';

type Mode = 'layout' | 'reveal' | 'drag';
const MODES: readonly (readonly [Mode, string])[] = [
  ['layout', '共享布局'], ['reveal', '增删与重排'], ['drag', '拖动约束'],
];
const ITEMS = [
  { id: 'coral', name: '珊瑚', color: '#b94329' },
  { id: 'blue', name: '靛蓝', color: '#3159a3' },
  { id: 'green', name: '薄荷', color: '#28745e' },
  { id: 'purple', name: '紫罗兰', color: '#7353a6' },
] as const;
type Item = typeof ITEMS[number];
const INITIAL_CARDS = [1, 2, 3, 4, 5, 6];
const DRAG_SIZE = 64;
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** Each colour has exactly one live layoutId, moving between two fixed slots. */
function SharedCard({item, motionOk}: {item: Item; motionOk: boolean}) {
  return <motion.div
    layoutId={`card-${item.id}`}
    data-motion-item={item.id}
    className="lab-motion-token"
    initial={false}
    style={{backgroundColor: item.color}}
    transition={motionOk ? {type: 'spring', stiffness: 320, damping: 32} : {duration: 0}}
  ><strong>{item.name}</strong><span>{item.color}</span></motion.div>;
}

export default function MotionLab({onCopy}: {onCopy: DemoCopyHandler}) {
  const motionOk = useMotionOk();
  const scope = useId();
  const [mode, setMode] = useState<Mode>('layout');
  const [activeId, setActiveId] = useState<Item['id'] | null>(null);
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [session, setSession] = useState(0);
  const fieldRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const x = useMotionValue(0), y = useMotionValue(0);
  const [position, setPosition] = useState({x: 0, y: 0});
  useMotionValueEvent(x, 'change', value => setPosition(current => ({...current, x: Math.round(value)})));
  useMotionValueEvent(y, 'change', value => setPosition(current => ({...current, y: Math.round(value)})));
  const active = ITEMS.find(item => item.id === activeId);
  const returnCard = () => {
    setActiveId(null);
    if (activeId) sourceRefs.current[activeId]?.focus({preventScroll: true});
  };

  const limits = () => ({
    x: Math.max(0, ((fieldRef.current?.clientWidth ?? DRAG_SIZE) - DRAG_SIZE) / 2 - 1),
    y: Math.max(0, ((fieldRef.current?.clientHeight ?? DRAG_SIZE) - DRAG_SIZE) / 2 - 1),
  });
  const center = () => {
    x.stop(); y.stop();
    void animate(x, 0, {duration: motionOk ? 0.25 : 0});
    void animate(y, 0, {duration: motionOk ? 0.25 : 0});
  };
  const reset = () => {
    x.stop(); y.stop(); x.set(0); y.set(0);
    setActiveId(null); setCards(INITIAL_CARDS); setMode('layout'); setSession(value => value + 1);
  };
  const changeMode = (next: Mode) => {
    x.stop(); y.stop(); x.set(0); y.set(0); setMode(next);
  };
  useEffect(() => {
    if (mode !== 'drag' || !fieldRef.current) return;
    const observer = new ResizeObserver(() => {
      const bounds = limits();
      x.stop(); y.stop(); x.set(clamp(x.get(), bounds.x)); y.set(clamp(y.get(), bounds.y));
    });
    observer.observe(fieldRef.current);
    return () => observer.disconnect();
  }, [mode, session, x, y]);
  const moveWithKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const arrows: Record<string, [number, number]> = {ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16]};
    if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); center(); return;}
    const delta = arrows[event.key];
    if (!delta) return;
    event.preventDefault(); x.stop(); y.stop();
    const bounds = limits();
    x.set(clamp(x.get() + delta[0], bounds.x)); y.set(clamp(y.get() + delta[1], bounds.y));
  };
  const snippet = mode === 'layout' ? `import { LayoutGroup, motion } from 'motion/react';

// 每张卡片只存在于来源和目标中的一个位置。
<LayoutGroup id="shared-cards">
  <div className="target">
    {activeId === item.id && <motion.div layoutId={item.id} />}
  </div>
  <div className="source">
    {activeId !== item.id && <motion.div layoutId={item.id} />}
  </div>
</LayoutGroup>` : mode === 'reveal' ? `import { AnimatePresence, motion } from 'motion/react';

// popLayout 的父级保持 position: relative。
<div style={{ position: 'relative', display: 'grid' }}>
  <AnimatePresence mode="popLayout" initial={false}>
    {cards.map(id => (
      <motion.button key={id} layout
        onClick={() => setCards(items => items.filter(item => item !== id))}
        exit={{ opacity: 0, scale: 0.7 }}>
        {id}
      </motion.button>
    ))}
  </AnimatePresence>
</div>` : `import { motion, useMotionValue, animate } from 'motion/react';

const x = useMotionValue(0), y = useMotionValue(0);
<motion.button drag dragConstraints={fieldRef}
  dragElastic={0} dragMomentum={false}
  style={{ x, y, touchAction: 'none' }} />

// 回中直接操作 MotionValue；坐标读数来自 change 事件。
animate(x, 0, { duration: 0.25 });
animate(y, 0, { duration: 0.25 });`;

  return <Lab title="Motion 布局与手势" badge={<span className="demo-live-badge">motion/react 12</span>} reset={reset}>
    <div className="lab-motion-demo">
      <Segmented<Mode> label="演示能力" value={mode} options={MODES} onChange={changeMode}/>
      <div className="lab-stage lab-motion-stage" key={session}>
        {mode === 'layout' ? <LayoutGroup id={`${scope}-${session}`}>
          <p className="lab-motion-help">点击卡片移入上方，再次点击收回。</p>
          <div className="lab-motion-target" role="group" aria-label="共享元素目标区域">
            {active ? <><SharedCard key={active.id} item={active} motionOk={motionOk}/><button type="button" className="lab-motion-return" aria-label="收回卡片" onClick={returnCard}>收回</button></> : <span>选择下方卡片</span>}
          </div>
          <div className="lab-motion-sources">
            {ITEMS.map(item => <button type="button" key={item.id} ref={element => {sourceRefs.current[item.id] = element;}} className="lab-motion-source" aria-label={`选择${item.name}`} aria-pressed={activeId === item.id} onClick={() => setActiveId(current => current === item.id ? null : item.id)}>
              {activeId === item.id ? <span className="lab-motion-placeholder">{item.name}<small>已移入上方</small></span> : <SharedCard item={item} motionOk={motionOk}/>}
            </button>)}
          </div>
          <p className="lab-motion-feedback" role="status">{active ? `当前：${active.name}` : '当前：未选择'}</p>
        </LayoutGroup> : null}
        {mode === 'reveal' ? <>
          <div className="lab-motion-actions">
            <button type="button" className="button button--primary button--small" disabled={cards.length === INITIAL_CARDS.length && cards.every((card, index) => card === INITIAL_CARDS[index])} onClick={() => setCards(INITIAL_CARDS)}>全部恢复</button>
            <button type="button" className="button button--secondary button--small" disabled={cards.length < 2} onClick={() => setCards(current => [...current].reverse())}>反转顺序</button>
            <button type="button" className="button button--secondary button--small" disabled={!cards.length} onClick={() => setCards([])}>清空卡片</button>
          </div>
          <p className="lab-motion-help">点击任意卡片移除，剩余卡片自动补位。</p>
          <div className="lab-motion-exit-grid">
            <AnimatePresence mode="popLayout" initial={false}>
              {cards.map(id => <motion.button type="button" key={id} layout data-motion-exit-card={id} aria-label={`移除卡片 ${String(id).padStart(2, '0')}`} className="lab-motion-exit-card"
                initial={motionOk ? {opacity: 0, scale: 0.7} : false} animate={{opacity: 1, scale: 1}}
                exit={{opacity: 0, scale: motionOk ? 0.7 : 1}}
                transition={motionOk ? {duration: 0.24, layout: {type: 'spring', stiffness: 360, damping: 32}} : {duration: 0}}
                onClick={() => setCards(current => current.filter(card => card !== id))}>
                <strong>{String(id).padStart(2, '0')}</strong><span>移除</span>
              </motion.button>)}
            </AnimatePresence>
            {!cards.length ? <p className="lab-motion-empty">已移除全部卡片</p> : null}
          </div>
          <p className="lab-motion-feedback" role="status">剩余 {cards.length} 张卡片</p>
        </> : null}
        {mode === 'drag' ? <>
          <div className="lab-motion-actions"><button type="button" className="button button--secondary button--small" onClick={center}>回到中心</button><output className="lab-motion-coordinates" aria-label="拖动坐标">x {position.x} · y {position.y}</output></div>
          <p className="lab-motion-help" id={`${scope}-drag-help`}>按住方块拖动；键盘方向键移动，Enter 回中。</p>
          <div className="lab-motion-drag-field" ref={fieldRef}>
            <motion.button type="button" drag dragConstraints={fieldRef} dragElastic={0} dragMomentum={false}
              className="lab-motion-handle" aria-label="拖动方块" aria-describedby={`${scope}-drag-help`}
              style={{x, y, touchAction: 'none'}} onKeyDown={moveWithKeys} onDragStart={() => {x.stop(); y.stop();}}>拖动</motion.button>
          </div>
        </> : null}
      </div>
      {!motionOk ? <Status>已开启减少动态效果，布局与增删直接完成；拖动和键盘操作仍可使用。</Status> : null}
    </div>
    <Code text={snippet} onCopy={onCopy} label="Motion 调用" maxHeight={320}/>
  </Lab>;
}
