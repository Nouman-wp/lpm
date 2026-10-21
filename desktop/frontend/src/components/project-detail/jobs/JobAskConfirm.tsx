import { noLabel, yesLabel } from "../../../jobAsk";
import type { JobAskFieldProps } from "./JobAskField";

// Yes and no as two buttons: a click answers outright when it's the only
// question, otherwise it marks the pick until the form is sent.
export function JobAskConfirm({ question: q, draft, onChange, onAnswer, disabled }: JobAskFieldProps) {
  const button = (value: "yes" | "no", label: string) => {
    const picked = draft.picks[0] === value;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onAnswer ? onAnswer(value === "yes") : onChange({ ...draft, picks: picked ? [] : [value] })
        }
        aria-pressed={onAnswer ? undefined : picked}
        className={`min-w-20 rounded-lg border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
          picked
            ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
            : "border-[var(--border)] text-[var(--text-primary)] enabled:hover:bg-[var(--bg-hover)]"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      {button("yes", yesLabel(q))}
      {button("no", noLabel(q))}
    </div>
  );
}
