import { dirname, joinPath } from "../../path";
import type { CommandMap } from "../backend";
import { addProject, cloneGit, freeName, project, type Project } from "./state";

// The dialog's label starts as the copy's folder name, so that's what it's called.
function copyName(label: unknown, fallback: string): string {
  return freeName(typeof label === "string" && label.trim() ? label.trim() : fallback);
}

function copyOf(src: Project, name: string, root: string): Project {
  return {
    ...src,
    name,
    root,
    label: undefined,
    parentName: src.parentName ?? src.name,
    running: new Set(),
    activeProfile: "",
    session: undefined,
    git: cloneGit(src.git),
    files: { ...src.files },
  };
}

// A full copy of the folder: same branch, uncommitted edits and all, unless the
// dialog left them out.
function duplicate({ name: source, label, excludeUncommitted }: Record<string, unknown>): string {
  const src = project(String(source));
  if (!src) throw new Error(`project "${source}" not found`);
  const name = copyName(label, `${src.parentName ?? src.name}-2`);
  const copy = copyOf(src, name, joinPath(dirname(src.root), name));
  if (excludeUncommitted) atHead(copy);
  addProject(copy);
  return name;
}

// A Git worktree: the last commit, checked out on a branch of its own.
function worktree({ name: source, label }: Record<string, unknown>): string {
  const src = project(String(source));
  if (!src) throw new Error(`project "${source}" not found`);
  const name = copyName(label, `${src.parentName ?? src.name}-wt`);
  const copy = copyOf(src, name, joinPath(dirname(src.root), `.worktrees/${name}`));
  copy.worktree = true;
  atHead(copy);
  const branch = `lpm/${name}`;
  copy.git = { ...copy.git, branch, upstream: false, ahead: 0, behind: 0 };
  copy.git.branches = [{ name: branch, ageMs: 0 }, ...copy.git.branches];
  addProject(copy);
  return name;
}

function atHead(p: Project): void {
  for (const c of p.git.changes) {
    if (c.status === "added") delete p.files[c.path];
    else p.files[c.path] = c.original;
  }
  p.git = { ...p.git, changes: [] };
}

export const copyCommands: CommandMap = {
  duplicate_project: duplicate,
  start_duplicate_project: duplicate,
  duplicate_worktree_project: worktree,
  start_duplicate_worktree_project: worktree,
  duplicate_status: () => ({ done: { ok: true, error: null } }),
};
