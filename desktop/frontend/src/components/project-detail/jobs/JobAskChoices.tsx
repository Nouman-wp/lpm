import { Check } from "lucide-react";
import { togglePick } from "../../../jobAsk";
import type { JobAskFieldProps } from "./JobAskField";
import { JobAskInput } from "./JobAskInput";
import { SHEET_BUTTON } from "./jobAskSheet";

// The options stacked full width. As the only question taking one, a click
// answers with it; otherwise a click marks the pick — one, or several when the
// question takes them. A box takes an answer of the user's own when allowed.
export function JobAskChoices({ question: q, draft, onChange, onAnswer, disabled }: JobAskFieldProps) {
  const own = draft.other.trim();
  return (
    <div className="flex flex-col gap-2">
      {(q.options ?? []).map((o) => {
        const picked = draft.picks.includes(o.label);
        return (
          <button
            key={o.label}
            type="button"
            role={onAnswer ? undefined : q.multiple ? "checkbox" : "radio"}
            aria-checked={onAnswer ? undefined : picked}
            disabled={disabled}
            onClick={() => (onAnswer ? onAnswer([o.label]) : onChange(togglePick(q, draft, o.label)))}
            className={`${SHEET_BUTTON[picked ? "picked" : "plain"]} flex items-center gap-3 text-left`}
          >
            <span className="min-w-0 flex-1">
              <span className="block">{o.label}</span>
              {o.description && (
                <span className="mt-0.5 block text-[11.5px] font-normal leading-snug text-[var(--text-muted)]">
                  {o.description}
                </span>
              )}
            </span>
            {picked && <Check size={15} strokeWidth={2.6} className="shrink-0 text-[var(--accent-cyan)]" />}
          </button>
        );
      })}
      {q.other && (
        <div className="flex gap-2">
          <JobAskInput
            value={draft.other}
            onChange={(e) =>
              onChange({ ...draft, other: e.target.value, picks: q.multiple ? draft.picks : [] })
            }
            placeholder="Something else…"
            disabled={disabled}
            className="min-h-10 flex-1"
          />
          {onAnswer && (
            <div className="w-24 shrink-0">
              <button type="submit" disabled={disabled || !own} className={SHEET_BUTTON.fill}>
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
