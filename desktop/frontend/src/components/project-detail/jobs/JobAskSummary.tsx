import { askStatusLabel, displayAnswer, type JobAsk } from "../../../jobAsk";
import { TONE_DOT_CLASS } from "../../../jobsFormat";
import { relativeAgo } from "../../../relativeTime";

// A closed question: how it ended, and what it was answered — or just the
// question, when the answer came as a plain reply (shown as the message after
// it) or never came.
export function JobAskSummary({ ask }: { ask: JobAsk }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT_CLASS.neutral}`} />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[var(--text-muted)]">
          {askStatusLabel(ask)}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
          {relativeAgo(ask.answeredAt ?? ask.askedAt)}
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {ask.questions.map((q) => {
          const answer = displayAnswer(q, ask.answers?.[q.id]);
          return (
            <p key={q.id} className="whitespace-pre-wrap text-[13px] leading-snug">
              <span className={answer ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}>
                {q.text}
              </span>
              {answer && (
                <span className="font-medium text-[var(--text-primary)]">
                  {" → "}
                  {answer}
                </span>
              )}
            </p>
          );
        })}
      </div>
    </>
  );
}
