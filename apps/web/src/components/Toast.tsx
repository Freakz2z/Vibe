import { useRef } from 'react';
import { usePresence } from '../hooks/usePresence';
import { CircleAlert, CircleCheck } from 'lucide-react';

export interface ToastData {
  id: number;
  text: string;
  tone: 'default' | 'error';
}

export function Toast({ toast }: { toast: ToastData | null }) {
  const last = useRef(toast);
  if (toast) last.current = toast;
  const presence = usePresence(Boolean(toast));
  const visible = presence.present ? toast ?? last.current : null;
  return (
    <div className="toast-region" aria-live={visible?.tone === 'error' ? 'assertive' : 'polite'}>
      {visible ? (
        <div className={`toast toast--${visible.tone}`} key={visible.id} data-state={presence.exiting ? 'closing' : 'open'} aria-hidden={presence.exiting || undefined}>
          {visible.tone === 'error' ? (
            <CircleAlert size={17} aria-hidden="true" />
          ) : (
            <CircleCheck size={17} aria-hidden="true" />
          )}
          <span>{visible.text}</span>
        </div>
      ) : null}
    </div>
  );
}
