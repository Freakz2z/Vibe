import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useReducedMotion } from './useReducedMotion';

const EASE = 'cubic-bezier(.22,1,.36,1)';
const CARDS = '.tool-card, .demo-card, .related-item';

/** Site chrome only. SDK demo canvases and their own animation loops stay independent. */
export function useSiteMotion(rootRef: RefObject<HTMLElement | null>, pathname: string, search: string, ready: boolean) {
  const reduced = useReducedMotion();
  const seen = useRef(new WeakSet<Element>());
  const previousPath = useRef('');
  const previousSearch = useRef('');

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!ready || !root) return;
    const routeChanged = previousPath.current !== pathname;
    const filtersChanged = previousSearch.current !== search;
    previousPath.current = pathname;
    previousSearch.current = search;
    if (reduced || !Element.prototype.animate) return;

    const running = new Set<Animation>();
    const frames = new Set<number>();
    const animate = (element: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions, id: string) => {
      if (!element?.isConnected) return;
      const animation = element.animate(keyframes, { duration: 260, easing: EASE, ...options });
      animation.id = id;
      running.add(animation);
      animation.finished.then(() => running.delete(animation), () => running.delete(animation));
    };
    if (routeChanged) {
      animate(root.querySelector('.page > header'), [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], {}, 'vibe-page-enter');
    } else if (filtersChanged) {
      animate(root.querySelector('.browse-heading__count'), [{ opacity: 0.35 }, { opacity: 1 }], { duration: 220 }, 'vibe-results');
    }

    const observed = new WeakSet<Element>();
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      let order = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.current.has(entry.target)) continue;
        seen.current.add(entry.target);
        observer?.unobserve(entry.target);
        animate(entry.target, [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 320, delay: Math.min(order++, 5) * 28, fill: 'backwards' }, 'vibe-card-enter');
      }
    }, { threshold: 0.06 }) : null;
    const scan = () => {
      for (const card of root.querySelectorAll(CARDS)) {
        if (!seen.current.has(card) && !observed.has(card)) {
          observed.add(card);
          observer?.observe(card);
        }
      }
    };
    scan();
    // Only direct changes to card grids; never observe SDK-generated DOM.
    const mutations = typeof MutationObserver === 'function' ? new MutationObserver(scan) : null;
    root.querySelectorAll('.tool-grid, .demo-grid').forEach(grid => mutations?.observe(grid, { childList: true }));

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('.demo-workspace')) return;
      const button = event.target.closest('.favorite-button, .favorite-detail, .quick-copy, .copy-button, .sidebar__item, .theme-menu button');
      if (!button) return;
      const frame = requestAnimationFrame(() => {
        frames.delete(frame);
        const favorite = button.matches('.favorite-button, .favorite-detail');
        animate(button.querySelector('svg'), favorite ? [
          { transform: 'scale(1)' }, { transform: 'scale(1.28)', offset: 0.35 },
          { transform: 'scale(.92)', offset: 0.7 }, { transform: 'scale(1)' },
        ] : [{ opacity: 0.45, transform: 'scale(.82)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: favorite ? 360 : 220 }, favorite ? 'vibe-favorite' : 'vibe-action');
      });
      frames.add(frame);
    };
    document.addEventListener('click', onClick);
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      document.removeEventListener('click', onClick);
      frames.forEach(cancelAnimationFrame);
      running.forEach(animation => animation.cancel());
    };
  }, [rootRef, pathname, search, ready, reduced]);
}
