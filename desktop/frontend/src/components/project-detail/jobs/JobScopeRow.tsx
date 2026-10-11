import { Lock, LockOpen } from "lucide-react";
import { RowSelect } from "./RowSelect";
import { JobRunsInMenu } from "./JobRunsInMenu";
import type { JobDraft } from "../../../jobsFormat";

const ACCESS: { value: JobDraft["access"]; label: string }[] = [
  { value: "full", label: "Full access" },
  { value: "read", label: "Read only" },
];

// Where the job runs and what an agent may do there, as two buttons under the
// run box, with a note for anything about the scope that isn't obvious.
export function JobScopeRow({
  draft,
  patch,
  onScope,
  options,
  lockedScope,
  canDuplicate,
  skippedCopies,
  problem,
}: {
  draft: JobDraft;
  patch: (values: Partial<JobDraft>) => void;
  onScope: (targets: string[]) => void;
  options: { value: string; label: string }[];
  lockedScope?: string;
  canDuplicate: boolean;
  skippedCopies: string[];
  problem: boolean;
}) {
  const notes = [
    skippedCopies.length > 0 &&
      `A job that runs in more than one project skips copies — it won't run in ${listNames(skippedCopies)}.`,
    canDuplicate &&
      draft.duplicateMode !== "none" &&
      `Each run works in a new ${draft.duplicateMode === "worktree" ? "worktree" : "copy"}, leaving the project untouched. The next run waits until you've looked at the last one and removed it.`,
  ].filter((n): n is string => Boolean(n));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <JobRunsInMenu
          targets={draft.targets}
          onTargets={onScope}
          options={options}
          lockedScope={lockedScope}
          duplicateMode={draft.duplicateMode}
          onDuplicateMode={(duplicateMode) => patch({ duplicateMode })}
          canDuplicate={canDuplicate}
          problem={problem}
        />
        {draft.runMode === "prompt" && (
          <RowSelect
            variant="pill"
            icon={draft.access === "read" ? <Lock size={13} /> : <LockOpen size={13} />}
            ariaLabel="Access"
            value={draft.access}
            onChange={(v) => patch({ access: v as JobDraft["access"] })}
            options={ACCESS}
          />
        )}
      </div>
      {notes.map((note) => (
        <p key={note} className="px-1 text-[12px] leading-snug text-[var(--text-muted)]">
          {note}
        </p>
      ))}
    </div>
  );
}

// "Foo", "Foo and Bar", "Foo, Bar and 3 more".
function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}
