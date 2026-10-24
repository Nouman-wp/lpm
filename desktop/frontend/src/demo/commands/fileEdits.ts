import type { CommandMap } from "../backend";
import { emitEvent } from "../ipc";
import { project, projectAt, type Project } from "./state";

// A folder made in the demo holds nothing yet, so the file map can't show it.
const emptyDirs = new Map<string, Set<string>>();

function madeDirs(p: Project): Set<string> {
  let dirs = emptyDirs.get(p.root);
  if (!dirs) emptyDirs.set(p.root, (dirs = new Set()));
  return dirs;
}

const find = (root: unknown) => project(String(root)) ?? projectAt(String(root));

function owner(root: unknown): Project {
  const p = find(root);
  if (!p) throw new Error("project not found");
  return p;
}

const under = (path: string, rel: string) => path === rel || path.startsWith(`${rel}/`);
const nameOf = (rel: string) => rel.slice(rel.lastIndexOf("/") + 1);

function exists(p: Project, rel: string): boolean {
  return [...Object.keys(p.files), ...madeDirs(p)].some((path) => under(path, rel));
}

function changed(p: Project): void {
  emitEvent("git-changed", { path: p.root, files: null });
}

// Taking a file away: one the commit holds shows as deleted, one only the
// working tree had just goes.
function drop(p: Project, path: string): string {
  const content = p.files[path];
  delete p.files[path];
  const at = p.git.changes.findIndex((c) => c.path === path);
  const change = at >= 0 ? p.git.changes[at] : null;
  if (change?.status === "added") p.git.changes.splice(at, 1);
  else if (change) Object.assign(change, { status: "deleted", modified: "" });
  else p.git.changes.push({ path, status: "deleted", original: content, modified: "" });
  return content;
}

function add(p: Project, path: string, content: string): void {
  p.files[path] = content;
  const change = p.git.changes.find((c) => c.path === path);
  if (change) Object.assign(change, { status: "modified", modified: content });
  else p.git.changes.push({ path, status: "added", original: "", modified: content });
}

// The folders the demo made that hold `rel`'s children, for the listing.
export function demoDirsIn(root: unknown, rel: string): string[] {
  const p = find(root);
  if (!p) return [];
  const prefix = rel ? `${rel}/` : "";
  return [...madeDirs(p)]
    .filter((dir) => dir.startsWith(prefix) && !dir.slice(prefix.length).includes("/"))
    .map((dir) => dir.slice(prefix.length));
}

export const fileEditCommands: CommandMap = {
  create_project_entry: ({ root, rel, isDir }) => {
    const p = owner(root);
    const path = String(rel);
    if (exists(p, path)) throw new Error(`${nameOf(path)} already exists`);
    if (isDir) madeDirs(p).add(path);
    else add(p, path, "");
    changed(p);
    return null;
  },
  rename_project_entry: ({ root, from, to }) => {
    const p = owner(root);
    const source = String(from);
    const target = String(to);
    if (!exists(p, source)) throw new Error(`${nameOf(source)} no longer exists`);
    if (exists(p, target)) throw new Error(`${nameOf(target)} already exists`);
    for (const path of Object.keys(p.files).filter((f) => under(f, source))) {
      add(p, target + path.slice(source.length), drop(p, path));
    }
    const dirs = madeDirs(p);
    for (const dir of [...dirs].filter((d) => under(d, source))) {
      dirs.delete(dir);
      dirs.add(target + dir.slice(source.length));
    }
    changed(p);
    return null;
  },
  trash_project_entry: ({ root, rel }) => {
    const p = owner(root);
    const path = String(rel);
    for (const file of Object.keys(p.files).filter((f) => under(f, path))) drop(p, file);
    const dirs = madeDirs(p);
    for (const dir of [...dirs].filter((d) => under(d, path))) dirs.delete(dir);
    changed(p);
    return null;
  },
};
