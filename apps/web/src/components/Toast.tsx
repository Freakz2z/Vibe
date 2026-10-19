import { CircleAlert, CircleCheck } from 'lucide-react';

export interface ToastData {
  id: number;
  text: string;
  tone: 'default' | 'error';
}

export function Toast({ toast }: { toast: ToastData | null }) {
  return (
    <div className="toast-region" aria-live={toast?.tone === 'error' ? 'assertive' : 'polite'}>
      {toast ? (
        <div className={`toast toast--${toast.tone}`} key={toast.id}>
          {toast.tone === 'error' ? (
            <CircleAlert size={17} aria-hidden="true" />
          ) : (
            <CircleCheck size={17} aria-hidden="true" />
          )}
          <span>{toast.text}</span>
        </div>
      ) : null}
    </div>
  );
}
