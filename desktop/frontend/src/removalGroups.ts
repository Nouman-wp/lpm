import type { ProjectInfo } from "./types";
import type { UnsavedWork } from "./unsavedWork";
import { count } from "./count";

export interface RemovalGroups {
  // Copies and worktrees: their folder goes with them.
  deleted: ProjectInfo[];
  // Originals: only the lpm entry goes; the folder stays on disk.
  kept: ProjectInfo[];
}

export function partitionRemoval(projects: ProjectInfo[]): RemovalGroups {
  return {
    deleted: projects.filter((p) => p.parentName),
    kept: projects.filter((p) => !p.parentName),
  };
}

export function removalTitle(total: number): string {
  return `Delete ${count(total, "project", "projects")}?`;
}

export function removalSummary({ deleted, kept }: RemovalGroups): string {
  const parts: string[] = [];
  if (deleted.length > 0) {
    parts.push(
      `${count(deleted.length, "folder", "folders")} ${deleted.length === 1 ? "is" : "are"} deleted from disk.`,
    );
  }
  if (kept.length > 0) {
    parts.push(
      kept.length === 1
        ? "1 entry leaves lpm and keeps its folder."
        : `${kept.length} entries leave lpm and keep their folders.`,
    );
  }
  return parts.join(" ");
}

export const removalConfirmPhrase = (total: number) => `delete ${total}`;

// Short labels for a row: what deleting this copy throws away.
export function unsavedWorkPills(work: UnsavedWork): string[] {
  const pills: string[] = [];
  const uncommitted = work.changed + work.untracked;
  if (uncommitted > 0) pills.push(count(uncommitted, "uncommitted file", "uncommitted files"));
  if (work.unpushed > 0) {
    pills.push(
      work.base
        ? `${count(work.unpushed, "commit", "commits")} not on ${work.base}`
        : count(work.unpushed, "unpushed commit", "unpushed commits"),
    );
  }
  return pills;
}

// What deleting a folder but not its projects does.
export function folderKeepText(projects: number): string {
  if (projects === 0) return "It's empty. Nothing on disk changes.";
  const moves =
    projects === 1 ? "Its 1 project moves" : `Its ${projects} projects move`;
  return `${moves} out of the folder. Nothing on disk changes.`;
}

export const deleteWithProjectsLabel = (projects: number) =>
  `Delete folder and its ${count(projects, "project", "projects")}…`;
