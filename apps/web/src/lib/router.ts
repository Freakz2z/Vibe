import { IS_TOY, routeHref } from './runtime';
import { useEffect, useLayoutEffect, useState } from 'react';

export interface RouteState {
  pathname: string;
  search: string;
  hash: string;
}

type HistoryState = Record<string, unknown> & {
  vibeKey?: string;
  vibeFrom?: string;
  vibeDirectory?: string;
  vibeDirectoryDepth?: number;
};

const NAVIGATION_EVENT = 'vibe:navigation';
const SCROLL_STORAGE_KEY = IS_TOY ? 'vibe-toy-scroll-positions' : 'vibe-scroll-positions';
const scrollPositions = new Map<string, number>();
let activeKey: string | null = null;
let pendingRestore: number | null = null;
let keySeed = 0;
let initialized = false;

function readRoute(): RouteState {
  if (IS_TOY) {
    const query = new URLSearchParams(window.location.search);
    const initial = query.get('tool') ? '/tools/' + encodeURIComponent(query.get('tool')!)
      : query.get('demo') ? '/demos/' + encodeURIComponent(query.get('demo')!) : query.get('game')==='quiz'?'/games/quiz':query.has('game')?'/games':'/';
    const logical = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : initial;
    const url = new URL(logical, 'https://vibe.invalid');
    return { pathname: url.pathname, search: url.search, hash: url.hash };
  }
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

function createKey(): string {
  keySeed += 1;
  return `vibe-${Date.now().toString(36)}-${keySeed}`;
}

function currentHistoryState(): HistoryState {
  const state = window.history.state;
  return state && typeof state === 'object' ? (state as HistoryState) : {};
}

function ensureHistoryKey(): string {
  const state = currentHistoryState();
  if (typeof state.vibeKey === 'string') return state.vibeKey;
  const key = createKey();
  window.history.replaceState({ ...state, vibeKey: key }, '');
  return key;
}

function readStoredPositions() {
  try {
    const raw = window.sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) scrollPositions.set(key, value);
    }
  } catch {
    // Session storage can be unavailable; scroll restoration then only works in memory.
  }
}

function persistPositions() {
  try {
    const record: Record<string, number> = {};
    for (const [key, value] of scrollPositions) record[key] = value;
    window.sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage failures must not break navigation.
  }
}

function rememberScroll() {
  if (!activeKey) activeKey = ensureHistoryKey();
  scrollPositions.set(activeKey, window.scrollY);
  persistPositions();
}

function initializeRouter() {
  if (initialized) return;
  initialized = true;
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }
  readStoredPositions();
  activeKey = ensureHistoryKey();
  const saved = scrollPositions.get(activeKey);
  if (typeof saved === 'number') pendingRestore = saved;
  window.addEventListener('pagehide', rememberScroll);
}

if (typeof window !== 'undefined') initializeRouter();

export function useRoute(ready = true): RouteState {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    initializeRouter();

    const syncNavigation = () => setRoute(readRoute());

    const syncPopState = () => {
      // The browser has moved to the new entry, but React still shows the old
      // page. Capture its scroll offset under the previous history key first.
      if (activeKey) {
        scrollPositions.set(activeKey, window.scrollY);
        persistPositions();
      }
      activeKey = ensureHistoryKey();
      pendingRestore = scrollPositions.get(activeKey) ?? 0;
      setRoute(readRoute());
    };

    window.addEventListener(NAVIGATION_EVENT, syncNavigation);
    window.addEventListener('popstate', syncPopState);
    if (IS_TOY) window.addEventListener('hashchange', syncNavigation);
    return () => {
      window.removeEventListener(NAVIGATION_EVENT, syncNavigation);
      window.removeEventListener('popstate', syncPopState);
      if (IS_TOY) window.removeEventListener('hashchange', syncNavigation);
    };
  }, []);

  useLayoutEffect(() => {
    // Wait for the page content that owns the scroll height before restoring.
    if (!ready || pendingRestore === null) return;
    const target = pendingRestore;
    pendingRestore = null;
    window.scrollTo({ top: target, left: 0, behavior: 'auto' });
  }, [ready, route]);

  return route;
}

export function navigate(
  href: string,
  options: { replace?: boolean; scroll?: 'top' | 'preserve' } = {},
): void {
  const currentRoute = readRoute();
  const current = `${currentRoute.pathname}${currentRoute.search}${currentRoute.hash}`;
  if (href === current) {
    if (options.scroll === 'top') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return;
  }

  initializeRouter();
  rememberScroll();

  const nextKey = createKey();
  const previousState = currentHistoryState();
  const destination = new URL(href, window.location.href);
  const targetIsDirectory = destination.pathname === '/';
  const currentIsDirectory = currentRoute.pathname === '/';

  let directory =
    typeof previousState.vibeDirectory === 'string' ? previousState.vibeDirectory : undefined;
  let directoryDepth =
    typeof previousState.vibeDirectoryDepth === 'number'
      ? previousState.vibeDirectoryDepth
      : undefined;

  if (targetIsDirectory) {
    // This new entry can itself become the directory a later detail returns to.
    directory = `${destination.pathname}${destination.search}${destination.hash}`;
    directoryDepth = 0;
  } else if (currentIsDirectory) {
    directory = current;
    directoryDepth = 1;
  } else if (directory) {
    // Related tools extend the trail; returning to the directory can skip it.
    directoryDepth = (directoryDepth ?? 0) + 1;
  }

  const state: HistoryState = {
    vibeKey: nextKey,
    vibeFrom: current,
    ...(directory
      ? { vibeDirectory: directory, vibeDirectoryDepth: directoryDepth ?? 0 }
      : {}),
  };
  if (options.replace) {
    window.history.replaceState(state, '', routeHref(href));
  } else {
    window.history.pushState(state, '', routeHref(href));
  }

  activeKey = nextKey;
  pendingRestore = options.scroll === 'preserve' ? null : 0;
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function buildQuery(values: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function withCurrentSearch(path: string, search: string): string {
  return search ? `${path}${search}` : path;
}
