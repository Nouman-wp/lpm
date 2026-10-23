// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { TerminalSearchBar } from "./TerminalSearchBar";
import type { FindDirection, FindOptions, FindOutcome, FindResults } from "./terminalFind";

let container: HTMLDivElement;
let root: Root;
let push: (results: FindResults) => void;
let onFind: Mock<(query: string, direction: FindDirection, options: FindOptions) => FindOutcome>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// The terminal answers each find with `outcome` and fires `results`, the way
// the search add-on fires its results event from inside findNext.
function render(answer: (query: string) => { outcome: FindOutcome; results: FindResults }) {
  onFind = vi.fn((query: string, _direction: FindDirection, _options: FindOptions) => {
    const { outcome, results } = answer(query);
    push(results);
    return outcome;
  });
  act(() => {
    root.render(
      <TerminalSearchBar
        filterMode={false}
        matchCount={0}
        onFind={onFind}
        onWatchResults={(cb) => {
          push = cb;
          return () => {};
        }}
        onFilterChange={() => {}}
        onToggleFilterMode={() => {}}
        onClose={() => {}}
      />,
    );
  });
}

function type(value: string) {
  const input = container.querySelector("input")!;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const label = () => container.querySelector("[aria-live]")?.textContent ?? null;
const button = (title: string) => container.querySelector<HTMLButtonElement>(`button[title="${title}"]`)!;

describe("TerminalSearchBar", () => {
  it("shows which match is selected out of how many", () => {
    render(() => ({ outcome: "found", results: { index: 0, count: 2 } }));
    type("Compiled");
    expect(label()).toBe("1 of 2");
  });

  it("says there are no matches", () => {
    render(() => ({ outcome: "none", results: { index: -1, count: 0 } }));
    type("nothing here");
    expect(label()).toBe("No matches");
  });

  it("keeps the count current as new output arrives", () => {
    render(() => ({ outcome: "found", results: { index: 0, count: 2 } }));
    type("GET");
    act(() => push({ index: 0, count: 5 }));
    expect(label()).toBe("1 of 5");
  });

  it("flags an unfinished regular expression", () => {
    render((q) => (q.endsWith("(") ? { outcome: "invalid", results: { index: -1, count: 0 } } : { outcome: "found", results: { index: 0, count: 1 } }));
    act(() => button("Use regular expression").click());
    type("a(");
    expect(label()).toBe("Invalid pattern");
  });

  it("searches again with match case and regular expressions turned on", () => {
    render(() => ({ outcome: "found", results: { index: 0, count: 1 } }));
    type("Error");
    act(() => button("Match case").click());
    expect(onFind).toHaveBeenLastCalledWith("Error", "next", { caseSensitive: true, regex: false });
    act(() => button("Use regular expression").click());
    expect(onFind).toHaveBeenLastCalledWith("Error", "next", { caseSensitive: true, regex: true });
  });

  it("clears the highlights and the count when the query is emptied", () => {
    render(() => ({ outcome: "found", results: { index: 0, count: 2 } }));
    type("Compiled");
    type("");
    expect(onFind).toHaveBeenLastCalledWith("", "next", { caseSensitive: false, regex: false });
    expect(label()).toBeNull();
  });
});
