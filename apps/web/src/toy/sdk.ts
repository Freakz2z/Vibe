export interface ContainerState {
  viewport: {width: number; height: number};
  safeArea: {top: number; right: number; bottom: number; left: number};
  orientation: 'portrait' | 'landscape';
  immersive: boolean;
  changedFields: string[];
}
interface ToySDK {
  isSupport(ability: string): Promise<boolean>;
  share(req: {path: string}): Promise<void>;
  getQrCode(req: {path: string; size: number}): Promise<{base64: string; url: string}>;
  getContainerState(): Promise<ContainerState>;
  onContainerChange(callback: (state: ContainerState) => void): () => void;
  setContainerMode(req: {orientation: 'portrait' | 'landscape' | 'auto'; immersive: boolean}): Promise<void>;
}
declare global { interface Window { toy?: ToySDK; } }
export async function supports(ability: string): Promise<boolean> {
  try { return Boolean(await window.toy?.isSupport(ability)); } catch { return false; }
}
export function sharePath(logical: string): string {
  const url = new URL(logical, 'https://vibe.invalid');
  const tool = /^\/tools\/([^/]+)$/.exec(url.pathname);
  const demo = /^\/demos\/([^/]+)$/.exec(url.pathname);
  const params = new URLSearchParams();
  if (tool) params.set('tool', decodeURIComponent(tool[1]));
  else if (demo) params.set('demo', decodeURIComponent(demo[1]));
  return 'index.html' + (params.size ? '?' + params.toString() : '');
}
export async function connectContainer() {
  const updateKeyboard = () => {
    const view = window.visualViewport;
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') || (document.activeElement as HTMLElement | null)?.isContentEditable;
    document.documentElement.dataset.keyboard = String(Boolean(typing && view && window.innerHeight - view.height > 120));
  };
  window.visualViewport?.addEventListener('resize', updateKeyboard);
  document.addEventListener('focusout', updateKeyboard);
  document.addEventListener('focusin', updateKeyboard);
  if (!await supports('onContainerChange')) return;
  const apply = (state: ContainerState) => {
    const root = document.documentElement;
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const value = state.safeArea?.[side];
      if (Number.isFinite(value)) root.style.setProperty(`--toy-safe-${side}`, `${Math.max(0, value)}px`);
    }
    if (state.viewport?.height > 0) root.style.setProperty('--toy-height', `${state.viewport.height}px`);
    root.dataset.immersive = String(state.immersive);
    root.dataset.orientation = state.orientation;
    window.dispatchEvent(new Event('resize'));
  };
  window.toy!.onContainerChange(apply);
  if (await supports('getContainerState')) {
    try { apply(await window.toy!.getContainerState()); } catch { /* CSS safe areas remain active. */ }
  }
}
