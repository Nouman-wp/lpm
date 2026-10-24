import { main } from "../../bridge/models";
import { openConflictAtMarker } from "../conflictFileOpen";

const SHOWN = 6;

const CHIP =
  "max-w-[220px] truncate rounded border border-[var(--accent-red)]/30 bg-[var(--bg-primary)] px-1.5 py-px font-mono text-[10.5px] text-[var(--accent-red-text)]";

export function ConflictNotice({
  files,
  projectPath,
}: {
  files: main.ChangedFile[];
  // Makes each file a chip that opens it at its first conflict marker.
  projectPath?: string;
}) {
  const paths = files.filter((f) => f.status === "conflicted").map((f) => f.path);
  if (paths.length === 0) return null;
  const more = paths.length - SHOWN;
  return (
    <div className="rounded-md bg-[var(--accent-red)]/10 px-2.5 py-1.5 text-[11px] text-[var(--accent-red-text)]">
      <p>
        {paths.length === 1 ? "This file has" : `${paths.length} files have`} merge conflicts.
        Resolve the conflict markers (&lt;&lt;&lt;&lt;&lt;&lt;&lt; … &gt;&gt;&gt;&gt;&gt;&gt;&gt;)
        before committing.
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {paths.slice(0, SHOWN).map((path) =>
          projectPath ? (
            <button
              key={path}
              onClick={() => void openConflictAtMarker(projectPath, path)}
              title={`Open ${path}`}
              className={`${CHIP} transition-colors hover:border-[var(--accent-red)]/60 hover:bg-[var(--bg-hover)]`}
            >
              {path}
            </button>
          ) : (
            <span key={path} title={path} className={CHIP}>
              {path}
            </span>
          ),
        )}
        {more > 0 && <span className="text-[var(--text-muted)]">+{more} more</span>}
      </div>
    </div>
  );
}
