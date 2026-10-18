import type { DiffStat } from "../hooks/useGitStatus";
import { LineCounts } from "./LineCounts";

// "+400 −100 · 57": lines added and removed, then the changed files.
export function DiffStatText({ stat, className = "" }: { stat: DiffStat; className?: string }) {
  const { files, linesAdded, linesRemoved } = stat;
  return (
    <span
      title={`${files} file${files === 1 ? "" : "s"} changed: ${linesAdded} line${linesAdded === 1 ? "" : "s"} added, ${linesRemoved} removed`}
      className={`flex items-center gap-1 tabular-nums ${className}`}
    >
      <LineCounts added={linesAdded} removed={linesRemoved} />
      {linesAdded + linesRemoved > 0 && <span aria-hidden="true">·</span>}
      <span>{files}</span>
    </span>
  );
}
