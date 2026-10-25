// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../../bridge/models";

vi.mock("../hooks/useBranchSearch", () => ({ useBranchSearch: () => null }));

import { BranchSearchMenu } from "./BranchSearchMenu";

const b = (name: string, remote?: string) =>
  ({ name, committerDate: 0, ...(remote ? { remote } : {}) }) as main.Branch;

const BRANCHES = [b("main"), b("feat-login"), b("feat-api", "origin")];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render() {
  const props = {
    onCheckout: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(async () => true),
    onDelete: vi.fn(),
    onRemoveRemote: vi.fn(),
    onCopyName: vi.fn(async () => true),
    onNewBranch: vi.fn(),
  };
  act(() =>
    root.render(
      <BranchSearchMenu
        projectPath="/tmp/web"
        branches={BRANCHES}
        current="main"
        uncommitted={0}
        busy={false}
        pruning={false}
        {...props}
      />,
    ),
  );
  const input = container.querySelector("input")!;
  return { input, ...props };
}

function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function press(input: HTMLInputElement, key: string, init: KeyboardEventInit = {}) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
}

const captions = () =>
  [...container.querySelectorAll("span")].map((s) => s.textContent).filter((t) => t === "Local" || t === "Remote");

describe("BranchSearchMenu", () => {
  it("groups branches under Local and Remote", () => {
    render();
    expect(captions()).toEqual(["Local", "Remote"]);
  });

  it("creates the typed branch with ↵ when nothing matches", () => {
    const { input, onCreate, onCheckout } = render();
    type(input, "Fix Header");
    expect(container.textContent).toContain("Create branch fix-header from main");
    press(input, "Enter");
    expect(onCreate).toHaveBeenCalledWith("fix-header");
    expect(onCheckout).not.toHaveBeenCalled();
  });

  it("keeps ↵ on the first match and reaches the create row with ↑", () => {
    const { input, onCreate, onCheckout } = render();
    type(input, "feat");
    press(input, "Enter");
    expect(onCheckout).toHaveBeenCalledWith(BRANCHES[1]);
    press(input, "ArrowUp");
    press(input, "Enter");
    expect(onCreate).toHaveBeenCalledWith("feat");
  });

  it("offers no create row for an exact branch name", () => {
    const { input } = render();
    type(input, "feat-login");
    expect(container.textContent).not.toContain("Create branch");
  });

  it("acts on the highlighted branch from the keyboard", () => {
    const { input, onCopyName, onDelete, onRemoveRemote } = render();
    press(input, "ArrowDown");
    press(input, "c", { metaKey: true });
    expect(onCopyName).toHaveBeenCalledWith("feat-login");
    press(input, "Backspace", { metaKey: true });
    expect(onDelete).toHaveBeenCalledWith(BRANCHES[1]);
    press(input, "ArrowDown");
    press(input, "Backspace", { metaKey: true });
    expect(onRemoveRemote).toHaveBeenCalledWith(BRANCHES[2]);
    press(input, "ArrowUp");
    press(input, "r", { metaKey: true });
    const rename = container.querySelectorAll("input")[1];
    expect(rename?.value).toBe("feat-login");
  });

  it("confirms a copy on that row's own copy button", async () => {
    const { input, onCopyName } = render();
    press(input, "ArrowDown");
    press(input, "c", { metaKey: true });
    await act(async () => {});
    const copied = container.querySelectorAll('[title="Copied"]');
    expect(copied).toHaveLength(1);
    expect(copied[0].closest("[data-branch-index]")?.getAttribute("data-branch-index")).toBe("1");

    onCopyName.mockResolvedValueOnce(false);
    press(input, "ArrowDown");
    press(input, "c", { metaKey: true });
    await act(async () => {});
    expect(container.querySelector('[data-branch-index="2"] [title="Copied"]')).toBeNull();
  });

  it("never deletes the current branch", () => {
    const { input, onDelete } = render();
    press(input, "Backspace", { metaKey: true });
    expect(onDelete).not.toHaveBeenCalled();
  });
});
