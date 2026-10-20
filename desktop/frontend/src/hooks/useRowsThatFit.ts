import { useLayoutEffect, useRef, useState } from "react";

// How many of a list's `rows` a page can show without scrolling, between `min`
// and `max`: what fits in the room left under `content`, the block in the
// scrolling `page` that holds the list. Each row is taken to be as tall as the
// step between two.
export function useRowsThatFit(min: number, max: number, rows: number) {
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(min);

  // Fitted before paint once the rows arrive, so the list never shows the
  // fewest first; then again whenever the page or the content resizes.
  useLayoutEffect(() => {
    const page = pageRef.current;
    const content = contentRef.current;
    if (!page || !content || rows === 0) return;
    const fit = () => {
      const shown = listRef.current?.children as HTMLCollectionOf<HTMLElement> | undefined;
      if (!shown?.length) return;
      const step = shown.length > 1 ? shown[1].offsetTop - shown[0].offsetTop : shown[0].offsetHeight;
      if (step <= 0) return;
      const bottom = content.getBoundingClientRect().bottom - page.getBoundingClientRect().top + page.scrollTop;
      const spare = page.clientHeight - bottom;
      setCount(Math.max(min, Math.min(max, shown.length + Math.floor(spare / step))));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(page);
    observer.observe(content);
    return () => observer.disconnect();
  }, [min, max, rows]);

  return { pageRef, contentRef, listRef, count };
}
