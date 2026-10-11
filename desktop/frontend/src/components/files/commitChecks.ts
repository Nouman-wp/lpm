import { checkState, type CheckState } from "../ChangedFilesTree";
import { ancestorsOf } from "./treeModel";

// The commit checkbox of every row in the changes rail: a file is in or out, a
// folder is all, some or none of the changed files beneath it.
export function selectionChecks(
  paths: readonly string[],
  selected: ReadonlySet<string>,
): ReadonlyMap<string, CheckState> {
  const checks = new Map<string, CheckState>();
  const folders = new Map<string, { selected: number; total: number }>();
  for (const path of paths) {
    const on = selected.has(path);
    checks.set(path, on ? "all" : "none");
    for (const dir of ancestorsOf(path)) {
      const count = folders.get(dir) ?? { selected: 0, total: 0 };
      count.total++;
      if (on) count.selected++;
      folders.set(dir, count);
    }
  }
  for (const [dir, count] of folders) checks.set(dir, checkState(count.selected, count.total));
  return checks;
}

// The changed files at `path` or anywhere beneath it.
export function changedUnder(paths: readonly string[], path: string): string[] {
  const prefix = `${path}/`;
  return paths.filter((p) => p === path || p.startsWith(prefix));
}
