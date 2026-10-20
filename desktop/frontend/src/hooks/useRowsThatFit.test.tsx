// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useRowsThatFit } from "./useRowsThatFit";

const ROW = 40;

function List({ pageHeight, contentBottom }: { pageHeight: number; contentBottom: number }) {
  const { pageRef, contentRef, listRef, count } = useRowsThatFit(3, 5, 5);
  const page = (el: HTMLDivElement | null) => {
    pageRef.current = el;
    if (!el) return;
    Object.defineProperty(el, "clientHeight", { configurable: true, value: pageHeight });
    el.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  };
  const content = (el: HTMLDivElement | null) => {
    contentRef.current = el;
    if (el) el.getBoundingClientRect = () => ({ bottom: contentBottom }) as DOMRect;
  };
  const row = (index: number) => (el: HTMLDivElement | null) => {
    if (el) Object.defineProperty(el, "offsetTop", { configurable: true, value: index * ROW });
  };
  return (
    <div ref={page}>
      <div ref={content}>
        <div ref={listRef}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} ref={row(i)} />
          ))}
        </div>
        <output>{count}</output>
      </div>
    </div>
  );
}

function shown(pageHeight: number, contentBottom: number): string {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<List pageHeight={pageHeight} contentBottom={contentBottom} />));
  const text = container.querySelector("output")?.textContent ?? "";
  act(() => root.unmount());
  return text;
}

describe("useRowsThatFit", () => {
  it("adds rows while the page has room, up to the most", () => {
    expect(shown(600, 500)).toBe("5");
  });

  it("adds only the rows that fit", () => {
    expect(shown(600, 600 - ROW - 10)).toBe("4");
  });

  it("keeps the fewest even when the page is short", () => {
    expect(shown(300, 600)).toBe("3");
  });
});
