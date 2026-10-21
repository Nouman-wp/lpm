import { noLabel, yesLabel } from "../../../jobAsk";
import type { JobAskFieldProps } from "./JobAskField";
import { SHEET_BUTTON } from "./jobAskSheet";

// Yes and no. As the only question, a click answers outright and yes leads,
// stacked; in a form the two sit side by side and mark the pick until it's sent.
export function JobAskConfirm({ question: q, draft, onChange, onAnswer, disabled }: JobAskFieldProps) {
  if (onAnswer) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" disabled={disabled} onClick={() => onAnswer(true)} className={SHEET_BUTTON.fill}>
          {yesLabel(q)}
        </button>
        <button type="button" disabled={disabled} onClick={() => onAnswer(false)} className={SHEET_BUTTON.plain}>
          {noLabel(q)}
        </button>
      </div>
    );
  }
  const button = (value: "yes" | "no", label: string) => {
    const picked = draft.picks[0] === value;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ ...draft, picks: picked ? [] : [value] })}
        aria-pressed={picked}
        className={SHEET_BUTTON[picked ? "picked" : "plain"]}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex gap-2">
      {button("yes", yesLabel(q))}
      {button("no", noLabel(q))}
    </div>
  );
}
