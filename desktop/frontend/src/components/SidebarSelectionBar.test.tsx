// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarSelectionBar } from "./SidebarSelectionBar";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.startsWith(label))!;

describe("SidebarSelectionBar", () => {
  const render = (props: Partial<Parameters<typeof SidebarSelectionBar>[0]> = {}) => {
    const handlers = { onRemove: vi.fn(), onDone: vi.fn(), onMenuOpenChange: vi.fn(), onMoveToGroup: vi.fn() };
    act(() => {
      root.render(
        <SidebarSelectionBar
          count={2}
          busy={false}
          width={260}
          folders={{
            groups: [{ id: "g1", name: "Clients", members: [] }],
            anyInGroup: false,
            onMoveToGroup: handlers.onMoveToGroup,
            onCreateGroupWith: vi.fn(),
          }}
          onRemove={handlers.onRemove}
          onDone={handlers.onDone}
          onMenuOpenChange={handlers.onMenuOpenChange}
          {...props}
        />,
      );
    });
    return handlers;
  };

  it("lays out the selection's actions", () => {
    const h = render({ onSideBySide: vi.fn() });
    expect(container.textContent).toContain("2 selected");
    expect(button("Side by side").disabled).toBe(false);
    act(() => button("Remove 2…").click());
    expect(h.onRemove).toHaveBeenCalledOnce();
    act(() => button("Done").click());
    expect(h.onDone).toHaveBeenCalledOnce();
  });

  it("keeps Side by side off when the selection doesn't fit", () => {
    render();
    expect(button("Side by side").disabled).toBe(true);
  });

  it("moves the selection through the folder menu", () => {
    const h = render();
    act(() => button("To folder").click());
    expect(h.onMenuOpenChange).toHaveBeenLastCalledWith(true);
    act(() => button("Clients").click());
    expect(h.onMoveToGroup).toHaveBeenCalledWith("g1");
    expect(h.onMenuOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("has nothing to act on while empty", () => {
    render({ count: 0 });
    expect(button("Remove 0…").disabled).toBe(true);
    expect(button("To folder").disabled).toBe(true);
  });
});
