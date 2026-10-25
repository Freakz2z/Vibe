import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
/** Keep the game inside the visible WebView, including the software keyboard. */
export function useGameViewport() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty(
        "--quiz-viewport",
        `${Math.round(window.visualViewport?.height || window.innerHeight)}px`,
      );
    update();
    window.scrollTo({ top: 0, behavior: "instant" });
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      root.style.removeProperty("--quiz-viewport");
    };
  }, []);
}
/** Long model text is paged at real line boundaries; no hidden scroll area or clipped copy. */
export function PagedCopy({
  paragraphs,
  label = "内容",
}: {
  paragraphs: string[];
  label?: string;
}) {
  const text = paragraphs.filter(Boolean).join("\n\n");
  const viewport = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLParagraphElement>(null);
  const [pages, setPages] = useState([text]);
  const [index, setIndex] = useState(0);
  useLayoutEffect(() => {
    let disposed = false;
    const paginate = () => {
      const box = viewport.current,
        probe = measure.current;
      if (!box || !probe || disposed) return;
      const chars = Array.from(text),
        next: string[] = [];
      let offset = 0;
      while (offset < chars.length) {
        let low = 1,
          high = chars.length - offset,
          fit = 1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          probe.textContent = chars.slice(offset, offset + mid).join("");
          if (probe.getBoundingClientRect().height <= box.clientHeight - 1) {
            fit = mid;
            low = mid + 1;
          } else high = mid - 1;
        }
        let chunk = chars.slice(offset, offset + fit).join("");
        const natural = Math.max(
          chunk.lastIndexOf("。"),
          chunk.lastIndexOf("；"),
          chunk.lastIndexOf("\n"),
        );
        if (offset + fit < chars.length && natural > chunk.length * 0.65) {
          chunk = chunk.slice(0, natural + 1);
          fit = Array.from(chunk).length;
        }
        next.push(chunk);
        offset += fit;
      }
      probe.textContent = "";
      setPages(next.length ? next : [""]);
      setIndex(0);
    };
    const observer = new ResizeObserver(paginate);
    if (viewport.current) observer.observe(viewport.current);
    paginate();
    void document.fonts.ready.then(paginate);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [text]);
  const current = Math.min(index, pages.length - 1);
  return (
    <div className="quiz-copy">
      <div className="quiz-copy-viewport" ref={viewport} aria-label={label}>
        <p aria-live="polite">{pages[current]}</p>
        <p className="quiz-copy-measure" aria-hidden="true" ref={measure} />
      </div>
      <div
        className="quiz-copy-pager"
        data-hidden={pages.length < 2}
        aria-hidden={pages.length < 2}
      >
        <button
          type="button"
          aria-label={`上一页${label}`}
          disabled={current === 0 || pages.length < 2}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft size={16} />
        </button>
        <small>
          {current + 1} / {pages.length}
        </small>
        <button
          type="button"
          aria-label={`下一页${label}`}
          disabled={current === pages.length - 1 || pages.length < 2}
          onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
