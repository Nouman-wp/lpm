// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  trash: vi.fn((_root: string, _path: string) => Promise.resolve(null)),
}));

vi.mock("../../notifications/toast", () => ({ toast: mocks.toast }));
vi.mock("../../../bridge/commands", () => ({ TrashProjectEntry: mocks.trash }));

import { TRASH_UNDO_MS, trashLater, usePendingTrashPaths } from "./trashQueue";

let container: HTMLDivElement;
let root: Root;
let shown: readonly string[] = [];

function Probe({ projectRoot }: { projectRoot: string }) {
  shown = usePendingTrashPaths(projectRoot);
  return null;
}

async function flush() {
  for (let i = 0; i < 3; i++) await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.toast.mockClear();
  mocks.toast.error.mockClear();
  mocks.trash.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe projectRoot="/p" />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const undo = () => (mocks.toast.mock.calls.at(-1)![1] as { action: { onClick: () => void } }).action.onClick();

describe("trashLater", () => {
  it("hides the entry at once and trashes it only once the Undo window is over", async () => {
    const refresh = vi.fn(() => Promise.resolve());
    act(() => trashLater("/p", "src/a.ts", refresh));
    expect(shown).toEqual(["src/a.ts"]);
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringMatching(/^Moved a\.ts to /), expect.anything());
    act(() => vi.advanceTimersByTime(TRASH_UNDO_MS - 1));
    expect(mocks.trash).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    await flush();
    expect(mocks.trash).toHaveBeenCalledWith("/p", "src/a.ts");
    expect(refresh).toHaveBeenCalled();
    expect(shown).toEqual([]);
  });

  it("puts the row back on Undo without touching the disk", async () => {
    act(() => trashLater("/p", "src/a.ts", () => Promise.resolve()));
    act(() => undo());
    expect(shown).toEqual([]);
    act(() => vi.advanceTimersByTime(TRASH_UNDO_MS));
    await flush();
    expect(mocks.trash).not.toHaveBeenCalled();
  });

  it("brings the row back and says why when the move fails", async () => {
    mocks.trash.mockImplementationOnce(() => Promise.reject("This host has no Trash"));
    act(() => trashLater("/p", "src", () => Promise.resolve()));
    act(() => vi.advanceTimersByTime(TRASH_UNDO_MS));
    await flush();
    expect(mocks.toast.error).toHaveBeenCalledWith(expect.stringContaining("This host has no Trash"));
    expect(shown).toEqual([]);
  });

  it("keeps each project's pending entries to itself", () => {
    act(() => trashLater("/other", "x.ts", () => Promise.resolve()));
    expect(shown).toEqual([]);
    act(() => undo());
  });
});
