import { GitMergeState } from "../bridge/commands";
import { joinAbs } from "./path";
import { openFileViewer } from "./store/fileViewer";
import type { MergeState } from "./mergeConflicts";

// Conflicted files open from the merge and commit dialogs, so the viewer sits
// above them, at the first conflict marker when there is one.
export function openConflictFile(projectPath: string, path: string, line = 0): void {
  openFileViewer({
    absPath: joinAbs(projectPath, path),
    line,
    col: line ? 1 : 0,
    projectRoot: projectPath,
    overDialog: true,
  });
}

export async function openConflictAtMarker(projectPath: string, path: string): Promise<void> {
  const line = await (GitMergeState(projectPath) as Promise<MergeState>)
    .then((s) => s.files.find((f) => f.path === path)?.firstLine ?? 0)
    .catch(() => 0);
  openConflictFile(projectPath, path, line);
}
