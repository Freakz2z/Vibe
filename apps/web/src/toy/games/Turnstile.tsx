import { useEffect, useRef, useState } from "react";
interface TurnstileAPI {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}
let loader: Promise<void> | undefined;
function load() {
  if (window.turnstile) return Promise.resolve();
  if (!loader)
    loader = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () =>
        window.turnstile ? resolve() : reject(new Error("Unavailable"));
      script.onerror = () => reject(new Error("Unavailable"));
      document.head.append(script);
    }).catch((e) => {
      loader = undefined;
      throw e;
    });
  return loader;
}
export function HumanCheck({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (value: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let id: string | undefined;
    setFailed(false);
    const timer = window.setTimeout(() => {
      if (!id && !disposed) setFailed(true);
    }, 12000);
    void load()
      .then(() => {
        if (disposed || !el.current) return;
        id = window.turnstile!.render(el.current, {
          sitekey: siteKey,
          action: "vibe_quiz",
          size: "flexible",
          theme: "auto",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(""),
          "error-callback": () => {
            setFailed(true);
            callback.current("");
          },
        });
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      clearTimeout(timer);
      callback.current("");
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, attempt]);
  return (
    <div className="quiz-verify">
      <div ref={el} />
      {failed ? (
        <p role="status">
          验证暂时没有加载。
          <button
            className="quiz-text-button"
            onClick={() => setAttempt((x) => x + 1)}
          >
            重试
          </button>
        </p>
      ) : (
        <small>完成验证后开启 AI 题目</small>
      )}
    </div>
  );
}
