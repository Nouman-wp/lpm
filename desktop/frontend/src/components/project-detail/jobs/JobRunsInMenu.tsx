import { FolderIcon } from "../../icons";
import { RowMenu } from "./RowMenu";
import { RowMenuItem } from "./RowMenuItem";
import type { DuplicateMode } from "../../../jobsFormat";

const WORKS_ON: { value: DuplicateMode; label: string; recap: string }[] = [
  { value: "none", label: "The project itself", recap: "" },
  { value: "copy", label: "A fresh copy of it", recap: "copy" },
  { value: "worktree", label: "A Git worktree of it", recap: "worktree" },
];

const HEADER_CLASS =
  "px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

// Where the job runs, as one button: the projects in scope (none = standalone,
// in the home folder) and, once there's a project, whether each run works on
// the project itself or a throwaway copy of it.
export function JobRunsInMenu({
  targets,
  onTargets,
  options,
  lockedScope,
  duplicateMode,
  onDuplicateMode,
  canDuplicate,
  problem,
}: {
  targets: string[];
  onTargets: (targets: string[]) => void;
  options: { value: string; label: string }[];
  // Shown in place of the project list for a scope it can't rewrite.
  lockedScope?: string;
  duplicateMode: DuplicateMode;
  onDuplicateMode: (mode: DuplicateMode) => void;
  canDuplicate: boolean;
  problem: boolean;
}) {
  const scope = lockedScope ?? projectsSummary(targets, options);
  const recap = canDuplicate ? WORKS_ON.find((o) => o.value === duplicateMode)?.recap : "";
  const toggle = (v: string) =>
    onTargets(targets.includes(v) ? targets.filter((x) => x !== v) : [...targets, v]);

  return (
    <RowMenu
      variant="pill"
      icon={<FolderIcon size={13} />}
      tone={problem ? "warn" : "normal"}
      label={recap ? `${scope} · ${recap}` : scope}
      ariaLabel={`Runs in ${scope}`}
      menuClassName="w-max min-w-[240px] max-w-[min(360px,calc(100vw-32px))] overflow-y-auto p-1"
    >
      {(close) => (
        <>
          <div className={HEADER_CLASS}>Runs in</div>
          {lockedScope ? (
            <p className="px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)]">{lockedScope}</p>
          ) : options.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[13px] text-[var(--text-muted)]">No projects yet.</p>
          ) : (
            options.map((o) => (
              <RowMenuItem
                key={o.value}
                label={o.label}
                active={targets.includes(o.value)}
                onClick={() => toggle(o.value)}
              />
            ))
          )}
          {!lockedScope && targets.length === 0 && (
            <p className="px-2.5 pb-1.5 pt-1 text-[11.5px] leading-snug text-[var(--text-muted)]">
              With none picked it runs standalone, in your home folder.
            </p>
          )}
          {canDuplicate && (
            <>
              <div className="mx-1 my-1 border-t border-[var(--border)]" />
              <div className={HEADER_CLASS}>Works on</div>
              {WORKS_ON.map((o) => (
                <RowMenuItem
                  key={o.value}
                  label={o.label}
                  active={o.value === duplicateMode}
                  onClick={() => {
                    onDuplicateMode(o.value);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </>
      )}
    </RowMenu>
  );
}

// "Standalone", the one project's name, or "3 projects".
function projectsSummary(value: string[], options: { value: string; label: string }[]): string {
  if (value.length === 0) return "Standalone";
  if (value.length === 1) return options.find((o) => o.value === value[0])?.label ?? value[0];
  return `${value.length} projects`;
}
