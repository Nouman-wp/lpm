import { describe, it, expect } from "vitest";
import { paneSpot, restorePane } from "./paneSpot";
import { findPane, makePaneLeaf, makeTerminal, removePane, type PaneLeaf, type PaneNode } from "./paneTree";

function leaf(id: string): PaneLeaf {
  return makePaneLeaf(id, [makeTerminal(`${id}-t`, id, { historyKey: `${id}-h` })]);
}

function split(direction: "row" | "col", ratio: number, a: PaneNode, b: PaneNode): PaneNode {
  return { kind: "split", direction, ratio, a, b };
}

// p1 | (p2 / p3)
const tree = split("row", 0.3, leaf("p1"), split("col", 0.7, leaf("p2"), leaf("p3")));

function closeAndRestore(root: PaneNode, paneId: string, edit: (n: PaneNode | null) => PaneNode | null = (n) => n) {
  const spot = paneSpot(root, paneId);
  return restorePane(edit(removePane(root, paneId)), findPane(root, paneId)!, spot);
}

describe("paneSpot", () => {
  it("records the split a pane sits in and its sibling's panes", () => {
    expect(paneSpot(tree, "p1")).toEqual({ direction: "row", ratio: 0.3, side: "a", siblingPaneIds: ["p2", "p3"] });
    expect(paneSpot(tree, "p3")).toEqual({ direction: "col", ratio: 0.7, side: "b", siblingPaneIds: ["p2"] });
  });

  it("is null for the only pane or one that isn't there", () => {
    expect(paneSpot(leaf("p1"), "p1")).toBeNull();
    expect(paneSpot(tree, "gone")).toBeNull();
  });
});

describe("restorePane", () => {
  it("puts a closed pane back exactly where it was", () => {
    expect(closeAndRestore(tree, "p1")).toEqual(tree);
    expect(closeAndRestore(tree, "p2")).toEqual(tree);
    expect(closeAndRestore(tree, "p3")).toEqual(tree);
  });

  it("splits the neighbor it sat against when its sibling has since changed", () => {
    const restored = closeAndRestore(tree, "p1", (n) => removePane(n!, "p3"));
    expect(restored).toEqual(split("row", 0.3, leaf("p1"), leaf("p2")));
  });

  it("splits off the whole tree when its sibling is gone", () => {
    const two = split("col", 0.4, leaf("p1"), leaf("p2"));
    const restored = closeAndRestore(two, "p2", () => leaf("p9"));
    expect(restored).toEqual(split("col", 0.4, leaf("p9"), leaf("p2")));
  });

  it("becomes the tree when nothing is left", () => {
    expect(restorePane(null, leaf("p1"), null)).toEqual(leaf("p1"));
  });
});
