import {
  collectPanes,
  findPane,
  type PaneLeaf,
  type PaneNode,
  type SplitDirection,
} from "./paneTree";

// Where a pane sat in the split tree. Closing it folds its split away, leaving
// the sibling subtree in the split's place, so putting it back means splitting
// that subtree again the same way.
export interface PaneSpot {
  direction: SplitDirection;
  ratio: number;
  side: "a" | "b";
  // The sibling subtree's panes in tree order.
  siblingPaneIds: string[];
}

// Null when the pane is the whole tree, or isn't in it.
export function paneSpot(node: PaneNode, paneId: string): PaneSpot | null {
  if (node.kind === "leaf") return null;
  for (const side of ["a", "b"] as const) {
    const child = node[side];
    if (child.kind !== "leaf" || child.id !== paneId) continue;
    const sibling = side === "a" ? node.b : node.a;
    return {
      direction: node.direction,
      ratio: node.ratio,
      side,
      siblingPaneIds: collectPanes(sibling).map((p) => p.id),
    };
  }
  return paneSpot(node.a, paneId) ?? paneSpot(node.b, paneId);
}

function sameIds(node: PaneNode, ids: Set<string>): boolean {
  const panes = collectPanes(node);
  return panes.length === ids.size && panes.every((p) => ids.has(p.id));
}

function findSubtree(node: PaneNode, ids: Set<string>): PaneNode | null {
  if (sameIds(node, ids)) return node;
  if (node.kind === "leaf") return null;
  return findSubtree(node.a, ids) ?? findSubtree(node.b, ids);
}

// The sibling as it stands now: the same panes, else the one that sat right
// against the closed pane, else any of them still open.
function siblingNow(root: PaneNode, spot: PaneSpot): PaneNode | null {
  const exact = findSubtree(root, new Set(spot.siblingPaneIds));
  if (exact) return exact;
  const nearestFirst = spot.side === "a" ? spot.siblingPaneIds : [...spot.siblingPaneIds].reverse();
  for (const id of nearestFirst) {
    const pane = findPane(root, id);
    if (pane) return pane;
  }
  return null;
}

function replaceNode(node: PaneNode, target: PaneNode, replacement: PaneNode): PaneNode {
  if (node === target) return replacement;
  if (node.kind === "leaf") return node;
  const a = replaceNode(node.a, target, replacement);
  const b = replaceNode(node.b, target, replacement);
  if (a === node.a && b === node.b) return node;
  return { ...node, a, b };
}

// Put a closed pane back beside its sibling. When the sibling is gone the pane
// splits off the whole tree from the same side; with no tree left it is the tree.
export function restorePane(root: PaneNode | null, pane: PaneLeaf, spot: PaneSpot | null): PaneNode {
  if (!root) return pane;
  const at = (spot && siblingNow(root, spot)) ?? root;
  const side = spot?.side ?? "a";
  return replaceNode(root, at, {
    kind: "split",
    direction: spot?.direction ?? "row",
    ratio: spot?.ratio ?? 0.5,
    a: side === "a" ? pane : at,
    b: side === "a" ? at : pane,
  });
}
