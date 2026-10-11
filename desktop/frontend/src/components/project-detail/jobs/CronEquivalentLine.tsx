import { useMemo } from "react";
import type { JobDraft } from "../../../jobsFormat";
import { cronEquivalent } from "../../../jobsCron";
import { draftToSchedule } from "../../../jobsScheduleDraft";

// The draft's schedule as a cron line, or why it has none.
export function CronEquivalentLine({ draft }: { draft: JobDraft }) {
  const result = useMemo(() => {
    const schedule = draftToSchedule(draft);
    return schedule ? cronEquivalent(schedule) : null;
  }, [draft]);

  if (!result) return null;

  return (
    <div className="mt-3 flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border)]/70 px-3 py-1.5 text-[12px] text-[var(--text-muted)]">
      {"cron" in result ? (
        <>
          As cron
          <code className="select-all rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text-primary)]">
            {result.cron}
          </code>
        </>
      ) : (
        result.reason
      )}
    </div>
  );
}
