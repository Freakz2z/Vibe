import { LabControls } from '../lab-kit';
import { useEffect, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaOptionsType } from 'embla-carousel';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Select, Stat, Stats, Status, useMotionOk } from '../lab-kit';

type Align = 'start' | 'center' | 'end';
type ScrollStep = '1' | '2' | 'auto';
type Contain = 'trimSnaps' | 'keepSnaps' | 'free';

const ALIGN_OPTIONS: readonly (readonly [Align, string])[] = [
  ['start', 'start 靠左'],
  ['center', 'center 居中'],
  ['end', 'end 靠右'],
];
const STEP_OPTIONS: readonly (readonly [ScrollStep, string])[] = [
  ['1', '每次 1 张'],
  ['2', '每次 2 张'],
  ['auto', 'auto 填满一屏'],
];
// Embla v8 的 containScroll：'trimSnaps' | 'keepSnaps' | false
const CONTAIN_OPTIONS: readonly (readonly [Contain, string])[] = [
  ['trimSnaps', "trimSnaps 掐掉多余吸附点"],
  ['keepSnaps', 'keepSnaps 全都保留'],
  ['free', 'false 完全放开'],
];

const BASE_SLIDES = ['算法', '编译器', '渲染管线', '网络协议', '数据库', '操作系统', '类型系统', '图形学', '音视频', '机器学习', '分布式', '安全'];

function buildOptions(align: Align, step: ScrollStep, contain: Contain): EmblaOptionsType {
  return {
    align,
    slidesToScroll: step === 'auto' ? 'auto' : Number(step),
    containScroll: contain === 'free' ? false : contain,
    loop: false,
    dragFree: true,
  };
}

/** Embla Carousel：真实 snap 计算 + selectedScrollSnap 读数 + 拖到首屏后自动重排。 */
export default function EmblaCarouselLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const motionOk = useMotionOk();

  const [align, setAlign] = useState<Align>('start');
  const [step, setStep] = useState<ScrollStep>('1');
  const [contain, setContain] = useState<Contain>('trimSnaps');
  const [slides, setSlides] = useState<string[]>(BASE_SLIDES);
  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [nonce, setNonce] = useState(0);

  const options = useMemo(() => buildOptions(align, step, contain), [align, step, contain]);
  const [emblaRef, emblaApi] = useEmblaCarousel(options);

  // Events are read from the instance. useEmblaCarousel destroys the API and detaches
  // its own handlers on unmount; we still unregister explicitly.
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    const onSettle = () => {
      setSelected(emblaApi.selectedScrollSnap());
      // Embla 官方写法：吸附回第 0 屏后把首项移到数组末尾，形成真实的数据重排。
      if (emblaApi.selectedScrollSnap() === 0) {
        setSlides((prev) => {
          if (prev.length < 2) return prev;
          const [head, ...tail] = prev;
          return [...tail, head];
        });
      }
    };

    emblaApi.on('select', onSelect).on('settle', onSettle);
    setSnapCount(emblaApi.scrollSnapList().length);
    setSelected(emblaApi.selectedScrollSnap());

    return () => {
      emblaApi.off('select', onSelect).off('settle', onSettle);
    };
  }, [emblaApi]);

  // Options changed -> ask Embla to recompute snaps on the same DOM nodes.
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit(options);
    setSnapCount(emblaApi.scrollSnapList().length);
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi, options]);

  useEffect(() => {
    if (!emblaApi) return;
    const onResize = () => {
      emblaApi.reInit(options);
      setSnapCount(emblaApi.scrollSnapList().length);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [emblaApi, options]);

  const snippet = useMemo(
    () =>
      [
        `import useEmblaCarousel from 'embla-carousel-react';`,
        ``,
        `const [emblaRef, emblaApi] = useEmblaCarousel({`,
        `  align: '${align}',`,
        `  slidesToScroll: ${step === 'auto' ? "'auto'" : step},`,
        `  containScroll: ${contain === 'free' ? 'false' : `'${contain}'`},`,
        `  dragFree: true,`,
        `});`,
        ``,
        `// 读数来自实例，不是自己记的页码`,
        `emblaApi.on('select', () => setSelected(emblaApi.selectedScrollSnap()));`,
        `const snaps = emblaApi.scrollSnapList();`,
        `emblaApi.scrollPrev(); emblaApi.scrollNext(); emblaApi.scrollTo(i);`,
        `emblaApi.reInit(options);   // 换 align / 步长后重算吸附点`,
        ``,
        `// 吸附回第 0 屏时把首项移到末尾再 reInit —— 无限循环的官方写法`,
        `emblaApi.on('settle', () => {`,
        `  if (emblaApi.selectedScrollSnap() === 0) {`,
        `    setSlides((prev) => [...prev.slice(1), prev[0]]);`,
        `  }`,
        `});`,
        ``,
        `// 卸载：off() 摘掉监听；useEmblaCarousel 内部会调用 emblaApi.destroy()`,
      ].join('\n'),
    [align, contain, step],
  );

  return (
    <Lab
      title="Embla 吸附分页"
      badge={<span className="demo-live-badge">embla-carousel 8.5</span>}
      reset={() => {
        setAlign('start');
        setStep('1');
        setContain('trimSnaps');
        setSlides(BASE_SLIDES);
        setNonce((n) => n + 1);
      }}
    >
      <LabControls className="lab-carousel-controls">
        <Select<Align> label="对齐 align" value={align} options={ALIGN_OPTIONS} onChange={setAlign} />
        <Select<ScrollStep> label="滚动步长 slidesToScroll" value={step} options={STEP_OPTIONS} onChange={setStep} />
        <Select<Contain> label="边界 containScroll" value={contain} options={CONTAIN_OPTIONS} onChange={setContain} />
      </LabControls>

      <div className="lab-stage lab-carousel-stage">
        <div className="lab-embla" ref={emblaRef} key={nonce}>
          <div className="lab-embla__container">
            {slides.map((label, i) => (
              <div className="lab-embla__slide" key={`${label}-${i}`} style={{ flexBasis: step === 'auto' ? 'auto' : '62%' }}>
                <div className="lab-embla__card">
                  <strong>{label}</strong>
                  <small>#{i + 1}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lab-embla__dots">
          {Array.from({ length: snapCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className="lab-embla__dot"
              data-active={i === selected}
              aria-label={`跳到第 ${i + 1} 个吸附点`}
              onClick={() => emblaApi?.scrollTo(i)}
            />
          ))}
        </div>

        <p className="lab-carousel-label">当前顺序</p>
        <ul className="lab-embla__list" aria-label="当前顺序">
          {slides.map((label, i) => (
            <li key={`${label}-${i}`}>{label}</li>
          ))}
        </ul>
      </div>

      <div className="lab-carousel-footer">
        <div className="lab-options">
          <button type="button" className="button button--primary button--small" disabled={!emblaApi?.canScrollPrev()} onClick={() => emblaApi?.scrollPrev()}>
            上一屏
          </button>
          <button type="button" className="button button--primary button--small" disabled={!emblaApi?.canScrollNext()} onClick={() => emblaApi?.scrollNext()}>
            下一屏
          </button>
          <button type="button" className="button button--secondary button--small" onClick={() => emblaApi?.scrollTo(0)}>
            回到开头
          </button>
        </div>
        <Stats>
          <Stat label="selectedScrollSnap()" value={selected} />
          <Stat label="吸附点总数" value={snapCount || '—'} />
        </Stats>
      </div>
      <p className="lab-motion-note">拖至开头并松手，可观察卡片重排与吸附点更新。</p>
      {!motionOk ? <Status>已开启减少动态效果，拖拽吸附仍然可用。</Status> : null}

      <Code text={snippet} onCopy={onCopy} label="Embla 调用" maxHeight={340} />
    </Lab>
  );
}
