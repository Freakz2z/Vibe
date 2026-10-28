import { useEffect, useState } from "react";
import { IS_TOY } from "../lib/runtime";
const QUERY = "(max-width: 900px)";
/** The website keeps desktop controls; narrow screens reuse the compact demo flow. */
export function useCompactDemo() {
  const [compact, setCompact] = useState(
    () =>
      IS_TOY ||
      (typeof window !== "undefined" && window.matchMedia(QUERY).matches),
  );
  useEffect(() => {
    if (IS_TOY) return;
    const media = window.matchMedia(QUERY);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
}
