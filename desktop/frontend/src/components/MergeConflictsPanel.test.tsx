// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MergeConflicts } from "../hooks/useMergeConflicts";
import type { useAIPicker } from "../hooks/useAIPicker";
import type { ConflictFile, ConflictSide, MergeState } from "../mergeConflicts";

const opened = vi.fn();
vi.mock("../conflictFileOpen", () => ({ openConflictFile: (...args: unknown[]) => opened(...args) }));

import { MergeConflictsPanel } from "./MergeConflictsPanel";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  opened.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const file = (path: string, conflicts: number, resolved = false): ConflictFile => ({
  path,
  conflicts,
  firstLine: conflicts ? 7 : 0,
  resolved,
});

function render(state: MergeState, sides: Map<string, ConflictSide> = new Map()) {
  const conflicts = {
    state,
    sides,
    pending: null,
    reload: vi.fn(),
    takeSide: vi.fn(),
    markResolved: vi.fn(),
    continueMerge: vi.fn(),
  } as unknown as MergeConflicts;
  const onContinue = vi.fn();
  act(() =>
    root.render(
      <MergeConflictsPanel
        projectPath="/tmp/web"
        conflicts={conflicts}
        interactive
        aiBusy={false}
        progressLine=""
        ai={{ anyAvailable: false } as ReturnType<typeof useAIPicker>}
        onResolveWithAI={() => {}}
        onCancelAI={() => {}}
        onAbort={() => {}}
        onContinue={onContinue}
        onDone={() => {}}
      />,
    ),
  );
  const button = (label: string) =>
    [...container.querySelectorAll("button")].filter((b) => b.textContent === label);
  return { conflicts, onContinue, button };
}

describe("MergeConflictsPanel", () => {
  it("lists each file with its count and holds the merge until all are resolved", () => {
    const { button, conflicts } = render({
      merging: true,
      source: "feature",
      files: [file("src/cart.ts", 3), file("README.md", 0, true)],
    });
    expect(container.textContent).toContain("1 of 2 files resolved");
    expect(container.textContent).toContain("3 conflicts");
    expect(container.textContent).toContain("resolved");
    expect(button("Continue merge")[0].disabled).toBe(true);

    act(() => button("Use theirs")[0].click());
    expect(conflicts.takeSide).toHaveBeenCalledWith("src/cart.ts", "theirs");
    act(() => button("Open")[0].click());
    expect(opened).toHaveBeenCalledWith("/tmp/web", "src/cart.ts", 7);
  });

  it("says which side resolved a file and lets the merge continue", () => {
    const { button, onContinue } = render(
      { merging: true, source: "feature", files: [file("a.ts", 0, true)] },
      new Map([["a.ts", "theirs" as const]]),
    );
    expect(container.textContent).toContain("resolved · used theirs");
    expect(button("Use ours")).toHaveLength(0);
    act(() => button("Continue merge")[0].click());
    expect(onContinue).toHaveBeenCalled();
  });

  it("offers Mark resolved once a file has no markers left", () => {
    const { button, conflicts } = render({ merging: true, source: "x", files: [file("a.ts", 0)] });
    act(() => button("Mark resolved")[0].click());
    expect(conflicts.markResolved).toHaveBeenCalledWith("a.ts");
  });
});
