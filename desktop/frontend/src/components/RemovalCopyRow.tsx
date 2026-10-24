import { useUnsavedWork } from "../hooks/useUnsavedWork";
import { peerRawName } from "../peer/markers";
import { unsavedWorkPills } from "../removalGroups";
import { worktreeBranchName } from "../unsavedWork";
import type { ProjectInfo } from "../types";

interface RemovalCopyRowProps {
  project: ProjectInfo;
  label: string;
}

const PILL = "shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-4";
const RED_PILL = `${PILL} bg-[color-mix(in_srgb,var(--accent-red)_14%,transparent)] text-[var(--accent-red-text)]`;
const MUTED_PILL = `${PILL} bg-[var(--bg-hover)] text-[var(--text-muted)]`;

// A copy or worktree in a batch delete, with the work that dies with its folder.
export function RemovalCopyRow({ project, label }: RemovalCopyRowProps) {
  const work = useUnsavedWork(project.root);
  const pills = work ? unsavedWorkPills(work) : [];
  return (
    <li className="flex items-center gap-2 px-3 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-[var(--text-primary)]" title={label}>
          {label}
        </div>
        {project.worktree && (
          <div className="truncate font-mono text-[11px] text-[var(--text-muted)]">
            and branch {worktreeBranchName(peerRawName(project.name))}
          </div>
        )}
      </div>
      {work === undefined ? (
        <span className={MUTED_PILL}>checking…</span>
      ) : pills.length > 0 ? (
        pills.map((pill) => (
          <span key={pill} className={RED_PILL}>
            {pill}
          </span>
        ))
      ) : (
        work && <span className={MUTED_PILL}>clean</span>
      )}
    </li>
  );
}
