import { CRON_FIELD_GUIDE } from "../../../../cronDescribe";
import type { CronField } from "../../../../cronExpr";

// What the field under the caret takes, with examples that drop straight into
// it.
export function CronFieldGuideCard({
  field,
  onUse,
}: {
  field: CronField;
  onUse: (token: string) => void;
}) {
  const guide = CRON_FIELD_GUIDE[field];
  return (
    <div className="rounded-xl bg-[var(--bg-secondary)]/40 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
          {guide.title}
        </span>
        <span className="font-mono text-[12px] text-[var(--text-muted)]">{guide.range}</span>
      </div>
      {guide.examples.map((ex) => (
        <div key={ex.token} className="border-t border-[var(--border)]/70 py-0.5">
          <button
            type="button"
            onClick={() => onUse(ex.token)}
            title={`Use ${ex.token}`}
            className="-mx-2 flex w-[calc(100%+1rem)] items-baseline gap-3 rounded-md px-2 py-1 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <code className="w-14 shrink-0 font-mono text-[var(--accent-cyan-text)]">{ex.token}</code>
            <span className="text-[var(--text-secondary)]">{ex.meaning}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
