import { main } from "../../bridge/models";

type ChangedFile = main.ChangedFile;

export type FileNode = {
  kind: "file";
  path: string;
  name: string;
  file: ChangedFile;
};
export type FolderNode = {
  kind: "folder";
  path: string;
  name: string;
  children: TreeNode[];
  fileCount: number;
};
export type TreeNode = FileNode | FolderNode;

export function buildTree(files: ChangedFile[]): TreeNode[] {
  const root: FolderNode = {
    kind: "folder",
    path: "",
    name: "",
    children: [],
    fileCount: 0,
  };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const folderPath = parts.slice(0, i + 1).join("/");
      let child = current.children.find(
        (c): c is FolderNode =>
          c.kind === "folder" && c.name === folderName,
      );
      if (!child) {
        child = {
          kind: "folder",
          path: folderPath,
          name: folderName,
          children: [],
          fileCount: 0,
        };
        current.children.push(child);
      }
      current = child;
    }

    current.children.push({
      kind: "file",
      path: file.path,
      name: parts[parts.length - 1],
      file,
    });
  }

  return sortNodes(root.children.map(collapseAndSort));
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Files in the exact order an already-built tree renders them (folders first,
// then files, alphabetically), so a flat list like the diff stack matches the
// tree view. Takes prebuilt nodes so a caller that also renders the tree does
// not pay for buildTree twice.
export function flattenNodes(nodes: TreeNode[]): ChangedFile[] {
  const out: ChangedFile[] = [];
  const walk = (ns: TreeNode[]) => {
    for (const node of ns) {
      if (node.kind === "file") out.push(node.file);
      else walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function flattenTree(files: ChangedFile[]): ChangedFile[] {
  return flattenNodes(buildTree(files));
}

function collapseAndSort(node: TreeNode): TreeNode {
  if (node.kind === "file") return node;

  const processed = node.children.map(collapseAndSort);

  if (processed.length === 1 && processed[0].kind === "folder") {
    const child = processed[0];
    return {
      kind: "folder",
      path: child.path,
      name: `${node.name}/${child.name}`,
      children: child.children,
      fileCount: child.fileCount,
    };
  }

  const sorted = sortNodes(processed);

  const fileCount = sorted.reduce(
    (acc, c) => acc + (c.kind === "file" ? 1 : c.fileCount),
    0,
  );

  return {
    kind: "folder",
    path: node.path,
    name: node.name,
    children: sorted,
    fileCount,
  };
}

export function fileDescendants(node: TreeNode): string[] {
  if (node.kind === "file") return [node.path];
  return node.children.flatMap(fileDescendants);
}
