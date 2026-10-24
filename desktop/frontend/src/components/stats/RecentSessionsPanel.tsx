import { useState } from "react";
import type { AgentSessionUsage } from "../../types";
import { SessionRow } from "./SessionRow";

const COLLAPSED_COUNT = 12;

interface RecentSessionsPanelProps {
  sessions: AgentSessionUsage[];
  /** Every session in view; only the latest ones are listed. */
  total: number;
  emptyLabel: string;
  // Display names by machine id, for sessions listed from several computers.
  machineNames?: Record<string, string>;
}

export function RecentSessionsPanel({
  sessions,
  total,
  emptyLabel,
  machineNames,
}: RecentSessionsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? sessions : sessions.slice(0, COLLAPSED_COUNT);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-medium">Recent sessions</h2>
        <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
          {shown.length} of {Math.max(total, sessions.length).toLocaleString()}
        </span>
      </div>

      {sessions.length === 0 ? (
        <div className="px-4 py-6 text-xs text-[var(--text-muted)]">
          {total > 0
            ? `${total.toLocaleString()} session${total === 1 ? "" : "s"} ${emptyLabel}, older than the ones listed`
            : `Nothing ${emptyLabel}`}
        </div>
      ) : (
        <>
          <div
            className="divide-y divide-[var(--border)] overflow-y-auto"
            style={{ maxHeight: expanded ? 420 : undefined }}
          >
            {shown.map((session, index) => (
              <SessionRow
                key={`${session.provider}-${session.project}-${session.startedAt}-${session.lastAt}-${index}`}
                session={session}
                machineName={session.machine ? machineNames?.[session.machine] : undefined}
              />
            ))}
          </div>
          {sessions.length > COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="w-full border-t border-[var(--border)] px-4 py-2 text-[11px] font-medium text-[var(--text-muted)] transition-colors duration-[120ms] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent-blue)]"
            >
              {expanded
                ? "Show less"
                : total > sessions.length
                  ? `Show the latest ${sessions.length}`
                  : `Show all (${sessions.length})`}
            </button>
          )}
          {expanded && total > sessions.length && (
            <div className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--text-muted)]">
              Only the {sessions.length} most recent sessions are listed.
            </div>
          )}
        </>
      )}
    </div>
  );
}
