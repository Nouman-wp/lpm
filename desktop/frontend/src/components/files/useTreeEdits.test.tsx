// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn((_root: string, _rel: string, _isDir: boolean) => Promise.resolve(null)),
  rename: vi.fn((_root: string, _from: string, _to: string) => Promise.resolve(null)),
  projects: [] as { name: string; isRemote: boolean }[],
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("../../../bridge/commands", () => ({
  CreateProjectEntry: mocks.create,
  RenameProjectEntry: mocks.rename,
  TrashProjectEntry: vi.fn(),
}));
vi.mock("../../store/app", () => ({
  useAppStore: (select: (s: { projects: typeof mocks.projects }) => unknown) => select({ projects: mocks.projects }),
}));

import { DRAFT_PATH } from "./treeEdits";
import type { Listing } from "./treeModel";
import { SSH_EDIT_BLOCKED, useTreeEdits, type TreeEdits } from "./useTreeEdits";

const LISTINGS = new Map<string, Listing>([
  ["", { status: "ready", entries: [{ name: "src", isDir: true }] }],
  ["src", { status: "ready", entries: [{ name: "a.ts", isDir: false }, { name: "b.ts", isDir: false }] }],
]);

let container: HTMLDivElement;
let root: Root;
let edits: TreeEdits;
const load = vi.fn((_dir: string) => Promise.resolve());
const expandDirs = vi.fn();
const openFile = vi.fn();

function Harness({ selectedPath = null, dirty = [] }: { selectedPath?: string | null; dirty?: string[] }) {
  edits = useTreeEdits({
    root: "/p",
    projectName: "shop",
    listings: LISTINGS,
    load,
    expandDirs,
    setQuery: () => {},
    showChangesOnly: () => {},
    openFile,
    selectedPath,
    dirtyPaths: new Set(dirty),
  });
  return null;
}

function mount(props: Parameters<typeof Harness>[0] = {}) {
  act(() => root.render(<Harness {...props} />));
}

async function settle(fn: () => void) {
  await act(async () => fn());
  for (let i = 0; i < 3; i++) await act(async () => {});
}

beforeEach(() => {
  mocks.projects = [];
  for (const fn of [mocks.create, mocks.rename, load, expandDirs, openFile]) fn.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useTreeEdits", () => {
  it("makes a new file in its folder, then opens it", async () => {
    mount();
    act(() => edits.create("src", false));
    expect(expandDirs).toHaveBeenCalledWith(["src"]);
    expect(edits.view).toMatchObject({ path: DRAFT_PATH, initial: "", isDir: false });
    await settle(() => edits.view!.onCommit("  c.ts "));
    expect(mocks.create).toHaveBeenCalledWith("/p", "src/c.ts", false);
    expect(load).toHaveBeenCalledWith("src");
    expect(openFile).toHaveBeenCalledWith("src/c.ts");
    expect(edits.edit).toBeNull();
  });

  it("says a name is taken as it is typed, and won't commit it", async () => {
    mount();
    act(() => edits.create("src", false));
    act(() => edits.view!.onChange("a.ts"));
    expect(edits.view!.problem).toBe("a.ts already exists");
    await settle(() => edits.view!.onCommit("a.ts"));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(edits.edit).not.toBeNull();
  });

  it("drops a blank name, on Enter or on blur", async () => {
    mount();
    act(() => edits.create("", true));
    await settle(() => edits.view!.onCommit(" "));
    expect(edits.edit).toBeNull();
    act(() => edits.create("", true));
    act(() => edits.view!.onBlur(""));
    expect(edits.edit).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps the field open with the host's reason when it refuses", async () => {
    mocks.create.mockImplementationOnce(() => Promise.reject("permission denied"));
    mount();
    act(() => edits.create("", false));
    await settle(() => edits.view!.onCommit("x.ts"));
    expect(edits.view!.problem).toBe("permission denied");
    act(() => edits.view!.onChange("y.ts"));
    expect(edits.view!.problem).toBeNull();
  });

  it("renames in place and follows the open file to its new path", async () => {
    mount({ selectedPath: "src/a.ts" });
    act(() => edits.rename({ path: "src", isDir: true }));
    expect(edits.view).toMatchObject({ path: "src", initial: "src", isDir: true });
    await settle(() => edits.view!.onCommit("app"));
    expect(mocks.rename).toHaveBeenCalledWith("/p", "src", "app");
    expect(load).toHaveBeenCalledWith("");
    expect(openFile).toHaveBeenCalledWith("app/a.ts");
  });

  it("leaves a rename to the same name alone", async () => {
    mount();
    act(() => edits.rename({ path: "src/a.ts", isDir: false }));
    await settle(() => edits.view!.onCommit("a.ts"));
    expect(mocks.rename).not.toHaveBeenCalled();
    expect(edits.edit).toBeNull();
  });

  it("won't rename past unsaved edits", async () => {
    mount({ dirty: ["src/b.ts"] });
    act(() => edits.rename({ path: "src", isDir: true }));
    await settle(() => edits.view!.onCommit("app"));
    expect(mocks.rename).not.toHaveBeenCalled();
    expect(edits.view!.problem).toBe("Save or discard the unsaved edits first");
  });

  it("changes nothing in a project on an SSH host", () => {
    mocks.projects = [{ name: "shop", isRemote: true }];
    mount();
    expect(edits.blocked).toBe(SSH_EDIT_BLOCKED);
    act(() => edits.create("", false));
    act(() => edits.rename({ path: "src", isDir: true }));
    expect(edits.edit).toBeNull();
  });
});
