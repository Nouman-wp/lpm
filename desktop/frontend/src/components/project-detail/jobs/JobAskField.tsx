import { modalInputClass } from "../../../forms/styles";
import {
  displayAnswer,
  type JobAskAnswer,
  type JobAskDraft,
  type JobAskQuestion,
} from "../../../jobAsk";
import { JobAskChoices } from "./JobAskChoices";
import { JobAskConfirm } from "./JobAskConfirm";
import { JobAskInput } from "./JobAskInput";

export interface JobAskFieldProps {
  question: JobAskQuestion;
  draft: JobAskDraft;
  onChange: (draft: JobAskDraft) => void;
  // Set when a click on yes or no is the whole answer.
  onAnswer?: (answer: JobAskAnswer) => void;
  disabled?: boolean;
}

// One question and the way it's answered: two buttons for yes/no, a list to
// pick from, or a box to write in.
export function JobAskField({ question: q, draft, onChange, onAnswer, disabled }: JobAskFieldProps) {
  return (
    <div className="mt-2.5 first:mt-0">
      <p className="whitespace-pre-wrap text-[13.5px] font-medium leading-snug text-[var(--text-primary)]">
        {q.text}
        {q.optional && <span className="ml-1.5 text-[11px] font-normal text-[var(--text-muted)]">optional</span>}
      </p>
      {q.default !== undefined && (
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
          Default: {displayAnswer(q, q.default)}
        </p>
      )}
      <div className="mt-2">
        {q.type === "confirm" ? (
          <JobAskConfirm question={q} draft={draft} onChange={onChange} onAnswer={onAnswer} disabled={disabled} />
        ) : q.type === "choice" ? (
          <JobAskChoices question={q} draft={draft} onChange={onChange} disabled={disabled} />
        ) : q.multiline ? (
          <textarea
            value={draft.text}
            onChange={(e) => onChange({ ...draft, text: e.target.value })}
            placeholder={q.placeholder}
            disabled={disabled}
            rows={3}
            className={`${modalInputClass} resize-y leading-relaxed`}
          />
        ) : (
          <JobAskInput
            value={draft.text}
            onChange={(e) => onChange({ ...draft, text: e.target.value })}
            placeholder={q.placeholder}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
