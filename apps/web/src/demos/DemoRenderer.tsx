import { Suspense, useEffect, useState, type ComponentType } from 'react';
import type { Demo } from '../types';
import type { DemoCopyHandler } from './types';
import { loadDemo } from './registry';

interface Resolved {
  Component: ComponentType<{ onCopy: DemoCopyHandler }> | null;
  error: string | null;
}

/**
 * Loads exactly the module for demo.stack. Changing stack aborts the previous
 * load and unmounts the old scene, so switching routes never leaks an SDK.
 */
export function DemoRenderer({ demo, onCopy }: { demo: Demo; onCopy: DemoCopyHandler }) {
  const [state, setState] = useState<Resolved>({ Component: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ Component: null, error: null });
    loadDemo(demo.stack).then(
      (module) => {
        if (!cancelled) setState({ Component: module.default, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setState({ Component: null, error: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [demo.stack]);

  if (state.error) {
    return (
      <div className="demo-workspace lab" role="alert">
        <p className="lab-error">示例模块加载失败：{state.error}</p>
      </div>
    );
  }

  if (!state.Component) {
    return (
      <div className="demo-workspace" role="status">
        正在加载 {demo.stack} 示例…
      </div>
    );
  }

  const Component = state.Component;
  return (
    <Suspense fallback={<div className="demo-workspace" role="status">正在加载示例…</div>}>
      <Component onCopy={onCopy} />
    </Suspense>
  );
}
