import { Bell, BellOff, Lock, LockOpen } from "lucide-react";
import { RowSelect } from "./RowSelect";
import { JobRunsInMenu } from "./JobRunsInMenu";
import { JobSendToMenu } from "./JobSendToMenu";
import { JobMemoryToggle } from "./JobMemoryToggle";
import type { JobDraft } from "../../../jobsFormat";
import {
  LPM_DESTINATION,
  canConnect,
  sendToReady,
  serviceLabel,
  splitSendTo,
} from "../../../sendTo";
import type { ConnectIntent } from "../../../sendToConnectors";
import { useSendToLinks } from "../../../hooks/useSendToLinks";

const ACCESS: { value: JobDraft["access"]; label: string }[] = [
  { value: "full", label: "Full access" },
  { value: "read", label: "Read only" },
];

const REPORT: { value: "every" | "found"; label: string }[] = [
  { value: "every", label: "Report every run" },
  { value: "found", label: "Only report findings" },
];

// Where the job runs, what an agent may do there, which of its runs get
// reported and where to, as buttons under the run box, with a note for anything
// about them that isn't obvious.
export function JobScopeRow({
  draft,
  patch,
  onScope,
  options,
  lockedScope,
  canDuplicate,
  skippedCopies,
  problem,
  onConnect,
}: {
  draft: JobDraft;
  patch: (values: Partial<JobDraft>) => void;
  onScope: (targets: string[]) => void;
  options: { value: string; label: string }[];
  lockedScope?: string;
  canDuplicate: boolean;
  skippedCopies: string[];
  problem: boolean;
  // Opens the dialog that links an outside service, or adds one of its chats,
  // without leaving the job.
  onConnect: (service: string, intent: ConnectIntent) => void;
}) {
  const links = useSendToLinks();
  const unready = draft.sendTo.filter((id) => sendToReady(id, links) === false);
  const notes = [
    skippedCopies.length > 0 &&
      `A job that runs in more than one project skips copies — it won't run in ${listNames(skippedCopies)}.`,
    canDuplicate &&
      draft.duplicateMode !== "none" &&
      `Each run works in a new ${draft.duplicateMode === "worktree" ? "worktree" : "copy"}, leaving the project untouched. The next run waits until you've looked at the last one and removed it.`,
    draft.runMode === "prompt" &&
      draft.quiet &&
      "A run that finds nothing leaves no trace: no notification and nothing in the job's history.",
    draft.sendTo.length > 0 &&
      !draft.sendTo.includes(LPM_DESTINATION) &&
      "lpm won't notify you about this job's runs, but they still land in its history.",
  ].filter((n): n is string => Boolean(n));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {draft.runMode === "prompt" && (
          <JobMemoryToggle
            value={draft.memory}
            readOnly={draft.access === "read"}
            onChange={(memory) => patch({ memory })}
          />
        )}
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
        {draft.runMode === "prompt" && (
          <RowSelect
            variant="pill"
            icon={draft.quiet ? <BellOff size={13} /> : <Bell size={13} />}
            ariaLabel="Which runs to report"
            value={draft.quiet ? "found" : "every"}
            onChange={(v) => patch({ quiet: v === "found" })}
            options={REPORT}
          />
        )}
        <JobSendToMenu
          value={draft.sendTo}
          onChange={(sendTo) => patch({ sendTo })}
          links={links}
          onConnect={onConnect}
        />
      </div>
      {notes.map((note) => (
        <p key={note} className="px-1 text-[12px] leading-snug text-[var(--text-muted)]">
          {note}
        </p>
      ))}
      {unready.map((id) => {
        const { service, key } = splitSendTo(id);
        const label = serviceLabel(service);
        const linked = links[service]?.connected;
        return (
          <p key={id} className="px-1 text-[12px] leading-snug text-[var(--accent-amber-text)]">
            {linked && key
              ? `“${key}” isn't one of your ${label} chats any more. `
              : `${label} isn't connected yet. `}
            {linked && key ? (
              <button
                type="button"
                onClick={() => patch({ sendTo: draft.sendTo.filter((x) => x !== id) })}
                className="font-medium text-[var(--accent-cyan-text)] hover:underline"
              >
                Stop sending there
              </button>
            ) : (
              canConnect(id) && (
                <button
                  type="button"
                  onClick={() => onConnect(service, "connect")}
                  className="font-medium text-[var(--accent-cyan-text)] hover:underline"
                >
                  Connect {label}
                </button>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}

// "Foo", "Foo and Bar", "Foo, Bar and 3 more".
function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}
