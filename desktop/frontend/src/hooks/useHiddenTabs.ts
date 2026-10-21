import { type DependencyList, type RefObject, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { hiddenTabs, NO_HIDDEN_TABS, sameHiddenTabs, type HiddenTabs } from "./tabOverflow";

export const STRIP_TAB_ATTR = "data-strip-tab";

// Which of a scrolling strip's tabs (marked with data-strip-tab) sit past its
// edges, re-read as it scrolls, resizes or its tabs change.
export function useHiddenTabs(
  ref: RefObject<HTMLElement | null>,
  edges: { left: boolean; right: boolean },
  zone: number,
  deps: DependencyList,
): HiddenTabs {
  const [hidden, setHidden] = useState<HiddenTabs>(NO_HIDDEN_TABS);
  const { left, right } = edges;

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const view = el.getBoundingClientRect();
    const tabs = Array.from(el.querySelectorAll<HTMLElement>(`[${STRIP_TAB_ATTR}]`), (tab) => {
      const box = tab.getBoundingClientRect();
      return { key: tab.getAttribute(STRIP_TAB_ATTR)!, left: box.left, right: box.right };
    });
    const next = hiddenTabs(view, tabs, { left, right }, zone);
    setHidden((prev) => (sameHiddenTabs(prev, next) ? prev : next));
  }, [ref, left, right, zone]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [ref, measure]);

  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return hidden;
}
