import { childPath, parentPath, type Item, type Listing, type TreeRow } from "./treeModel";

// A name being typed into the tree: a new entry's, or an existing one's new name.
export type NameEdit =
  | { kind: "create"; dir: string; isDir: boolean }
  | { kind: "rename"; path: string; isDir: boolean };

// The blank row a new entry is named in. No project path can begin with NUL.
export const DRAFT_PATH = "\u0000new";

// The folder something made from `item` goes in: the folder itself, or the
// one holding the file.
export function folderFor(item: Item | null): string {
  if (!item) return "";
  return item.isDir ? item.path : parentPath(item.path);
}

// The rows with a new entry's blank row at the top of its folder. Nothing is
// added while that folder's own row isn't on screen.
export function withDraftRow(rows: TreeRow[], edit: NameEdit | null): TreeRow[] {
  if (edit?.kind !== "create") return rows;
  let at = 0;
  let depth = 0;
  if (edit.dir) {
    const index = rows.findIndex((r) => r.path === edit.dir);
    if (index < 0) return rows;
    at = index + 1;
    depth = rows[index].depth + 1;
  }
  const draft: TreeRow = {
    path: DRAFT_PATH,
    name: "",
    isDir: edit.isDir,
    depth,
    expanded: false,
    loading: false,
    error: null,
  };
  return [...rows.slice(0, at), draft, ...rows.slice(at)];
}

export function isUnder(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}/`);
}

// The rows less every entry waiting out its Undo on the way to the Trash.
export function withoutPending(rows: TreeRow[], pending: readonly string[]): TreeRow[] {
  if (pending.length === 0) return rows;
  return rows.filter((r) => !pending.some((p) => isUnder(r.path, p)));
}

// The names already in `dir`, as far as its listing knows.
export function namesIn(listings: ReadonlyMap<string, Listing>, dir: string): string[] {
  const listing = listings.get(dir);
  return listing?.status === "ready" ? listing.entries.map((e) => e.name) : [];
}

// Where `path` ends up once `from` is renamed to `to`, or null when the rename
// doesn't reach it.
export function renamedPath(path: string, from: string, to: string): string | null {
  return isUnder(path, from) ? to + path.slice(from.length) : null;
}

export function nameTarget(edit: NameEdit, name: string): string {
  return edit.kind === "create"
    ? childPath(edit.dir, name)
    : childPath(parentPath(edit.path), name);
}
