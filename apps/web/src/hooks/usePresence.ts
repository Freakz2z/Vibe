import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Keep a closing surface mounted for its exit, without delaying focus restoration. */
export function usePresence(open: boolean, duration = 160) {
  const reduced = useReducedMotion();
  const [retained, setRetained] = useState(open);
  useEffect(() => {
    if (open) {
      setRetained(true);
      return;
    }
    if (reduced) {
      setRetained(false);
      return;
    }
    const timer = window.setTimeout(() => setRetained(false), duration);
    return () => window.clearTimeout(timer);
  }, [open, reduced, duration]);
  return { present: open || retained, exiting: !open };
}
