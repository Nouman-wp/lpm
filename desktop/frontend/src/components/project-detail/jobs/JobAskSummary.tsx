import { displayAnswer, type JobAsk } from "../../../jobAsk";

// A closed question with what it was answered — or just the question, when the
// answer came as a plain reply (shown as the message after it) or never came.
export function JobAskSummary({ ask }: { ask: JobAsk }) {
  return (
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
  );
}
