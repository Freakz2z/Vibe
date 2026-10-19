import { useEffect, useState } from 'react';

export interface RouteState {
  pathname: string;
  search: string;
  hash: string;
}

function readRoute(): RouteState {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

export function useRoute(): RouteState {
  const [route, setRoute] = useState<RouteState>(readRoute);

  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  return route;
}

export function navigate(href: string, options: { replace?: boolean } = {}): void {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (href === current) return;

  if (options.replace) {
    window.history.replaceState(null, '', href);
  } else {
    window.history.pushState(null, '', href);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
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
