import { Check } from "lucide-react";
import { togglePick } from "../../../jobAsk";
import type { JobAskFieldProps } from "./JobAskField";
import { JobAskInput } from "./JobAskInput";

// The options as a list to pick from — one, or several when the question takes
// them — and a box for an answer of the user's own when it allows one.
export function JobAskChoices({ question: q, draft, onChange, disabled }: JobAskFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      {(q.options ?? []).map((o) => {
        const picked = draft.picks.includes(o.label);
        return (
          <button
            key={o.label}
            type="button"
            role={q.multiple ? "checkbox" : "radio"}
            aria-checked={picked}
            disabled={disabled}
            onClick={() => onChange(togglePick(q, draft, o.label))}
            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50 ${
              picked
                ? "border-[var(--accent-cyan)] bg-[color-mix(in_srgb,var(--accent-cyan)_8%,transparent)]"
                : "border-[var(--border)] enabled:hover:bg-[var(--bg-hover)]"
            }`}
          >
            <span
              className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border ${
                q.multiple ? "rounded" : "rounded-full"
              } ${picked ? "border-[var(--accent-cyan)] bg-[var(--accent-cyan)] text-[var(--bg-primary)]" : "border-[var(--text-muted)]"}`}
            >
              {picked && <Check size={11} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-[var(--text-primary)]">{o.label}</span>
              {o.description && (
                <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--text-muted)]">
                  {o.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {q.other && (
        <JobAskInput
          value={draft.other}
          onChange={(e) =>
            onChange({ ...draft, other: e.target.value, picks: q.multiple ? draft.picks : [] })
          }
          placeholder="Something else…"
          disabled={disabled}
          className="mt-1"
        />
      )}
    </div>
  );
}
