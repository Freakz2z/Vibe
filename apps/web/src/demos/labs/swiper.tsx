import { useEffect, useMemo, useRef, useState } from 'react';
import Swiper from 'swiper';
import { A11y, Autoplay, Keyboard, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Range, Stat, Stats, Status, useMotionOk, useThemeColors } from '../lab-kit';

const SLIDE_COUNT = 8;
const LABELS = ['春', '夏', '秋', '冬', '晨', '午', '暮', '夜'];

/** Swiper v14：vanilla 实例（模块化导入），真实分页 / 键盘 / 自动播放与 activeIndex。 */
export default function SwiperLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();
  const colors = useThemeColors();
  const rootRef = useRef<HTMLDivElement>(null);
  const swiperRef = useRef<Swiper | null>(null);
  const [nonce, setNonce] = useState(0);

  const [loop, setLoop] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [delay, setDelay] = useState(1200);
  const [slidesPerView, setSlidesPerView] = useState(1.2);
  const [active, setActive] = useState(0);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);

  const accent = colors.accent ?? '#d95a3f';
  const surface = colors.surface ?? '#fffdf9';
  const line = colors['line-strong'] ?? '#cfc4bb';

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const instance = new Swiper(root, {
      modules: [Pagination, Keyboard, Autoplay, A11y],
      slidesPerView,
      spaceBetween: 12,
      loop,
      grabCursor: true,
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: { enabled: true, containerMessage: '演示轮播，可用左右方向键切换' },
      pagination: { el: '.lab-swiper-pagination', clickable: true },
      autoplay: autoplay && motionOk ? { delay, disableOnInteraction: false } : false,
      on: {
        init(sw) {
          setActive(sw.realIndex);
        },
        slideChange(sw) {
          setActive(sw.realIndex);
          setIsBeginning(sw.isBeginning);
          setIsEnd(sw.isEnd);
        },
      },
    });

    swiperRef.current = instance;

    return () => {
      instance.destroy(true, true);
      swiperRef.current = null;
    };
  }, [loop, autoplay, delay, slidesPerView, motionOk, accent, surface, line, nonce]);

  const snippet = useMemo(
    () =>
      [
        `import Swiper from 'swiper';`,
        `import { A11y, Autoplay, Keyboard, Pagination } from 'swiper/modules';`,
        `import 'swiper/css';`,
        `import 'swiper/css/pagination';`,
        ``,
        `const swiper = new Swiper(el, {`,
        `  modules: [Pagination, Keyboard, Autoplay, A11y],`,
        `  slidesPerView: ${slidesPerView},`,
        `  spaceBetween: 12,`,
        `  loop: ${loop},`,
        `  keyboard: { enabled: true },`,
        `  pagination: { el: '.lab-swiper-pagination', clickable: true },`,
        `  autoplay: ${autoplay ? `{ delay: ${delay}, disableOnInteraction: false }` : 'false'},`,
        `  on: {`,
        `    slideChange(sw) { setActive(sw.realIndex); },   // realIndex 才是数据的真实下标`,
        `  },`,
        `});`,
        ``,
        `swiper.slideNext(); swiper.slidePrev();`,
        `swiper.slideToLoop(3, 0);`,
        ``,
        `// 卸载：destroy 同时清掉所有模块、事件与 DOM 标记`,
        `swiper.destroy(true, true);`,
      ].join('\n'),
    [autoplay, delay, loop, slidesPerView],
  );

  return (
    <Lab
      title="Swiper 触摸分页"
      badge={<span className="demo-live-badge">swiper 14.3</span>}
      reset={() => {
        setLoop(true);
        setAutoplay(false);
        setDelay(1200);
        setSlidesPerView(1.2);
        setNonce((n) => n + 1);
      }}
    >
      <div className="lab-layout">
        <div className="lab-controls">
          <Range
            label="每屏可见张数"
            value={slidesPerView}
            min={1}
            max={3.4}
            step={0.1}
            onChange={setSlidesPerView}
            hint="小于 1 可以露出下一张的边缘。"
          />
          <Range label="自动播放间隔" value={delay} min={400} max={4000} step={100} unit=" ms" onChange={setDelay} />
          <div className="lab-options">
            <label>
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              循环 loop
            </label>
            <label>
              <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
              自动播放 autoplay
            </label>
          </div>
          <div className="lab-options">
            <button type="button" className="button button--primary button--small" disabled={isBeginning} onClick={() => swiperRef.current?.slidePrev()}>
              上一张
            </button>
            <button type="button" className="button button--primary button--small" disabled={isEnd} onClick={() => swiperRef.current?.slideNext()}>
              下一张
            </button>
            <button type="button" className="button button--secondary button--small" onClick={() => swiperRef.current?.slideTo(0, 400)}>
              回到第一张
            </button>
          </div>
          <Stats>
            <Stat label="realIndex" value={active} />
            <Stat label="当前进度" value={`${Math.round(((active + 1) / SLIDE_COUNT) * 100)}%`} />
          </Stats>
          <p className="lab-motion-note">用鼠标拖拽或直接按键盘 ← →（先点一下轮播区域取得焦点）。上面的 realIndex 来自 Swiper 实例，不是自己记的页码。</p>
          {!motionOk ? <Status>系统开启了「减少动态效果」，autoplay 被强制关闭，其余交互不受影响。</Status> : null}
        </div>

        <div className="lab-stage">
          <div className="lab-swiper-box">
          <div ref={rootRef} className="swiper lab-swiper-root" tabIndex={0} aria-label="Swiper 轮播区域">
            <div className="swiper-wrapper">
              {LABELS.map((label, i) => (
                <div className="swiper-slide" key={label}>
                  <div
                    className="lab-swiper-slide"
                    style={{
                      background: i === active ? `color-mix(in srgb, var(--accent) 16%, var(--surface))` : 'var(--surface)',
                      borderColor: i === active ? 'var(--accent)' : 'var(--line)',
                    }}
                  >
                    <strong>{label}</strong>
                    <span>第 {i + 1} 张</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lab-swiper-pagination" />
          </div>
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Swiper 调用" maxHeight={340} />
    </Lab>
  );
}
