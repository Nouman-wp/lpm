import type { TreeNode } from "./ChangedFilesTree";

export interface TreeRowEntry {
  node: TreeNode;
  depth: number;
}

// The rows a changed-files tree shows, in render order: every node that sits
// under open folders only.
export function visibleRows(nodes: TreeNode[], collapsed: ReadonlySet<string>): TreeRowEntry[] {
  const rows: TreeRowEntry[] = [];
  const walk = (level: TreeNode[], depth: number) => {
    for (const node of level) {
      rows.push({ node, depth });
      if (node.kind === "folder" && !collapsed.has(node.path)) walk(node.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return rows;
}

// How many files under each folder are selected, in one pass, so a folder's
// checkbox is a lookup rather than a walk of everything beneath it per render.
export function selectedCounts(
  nodes: TreeNode[],
  selected: ReadonlySet<string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (node: TreeNode): number => {
    if (node.kind === "file") return selected.has(node.path) ? 1 : 0;
    let count = 0;
    for (const child of node.children) count += walk(child);
    counts.set(node.path, count);
    return count;
  };
  nodes.forEach(walk);
  return counts;
}
