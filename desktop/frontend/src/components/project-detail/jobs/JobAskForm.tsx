import { useState } from "react";
import { AnswerJobQuestion, DismissJobQuestion } from "../../../../bridge/commands";
import {
  answersOnClick,
  draftAnswers,
  EMPTY_ASK_DRAFT,
  type JobAsk,
  type JobAskAnswer,
  type JobAskDraft,
} from "../../../jobAsk";
import { JobAskField } from "./JobAskField";

interface JobAskFormProps {
  ask: JobAsk;
  // Where the job is waiting — the project its answer goes to.
  project: string;
  jobId: string;
  onAnswered?: () => void;
}

// The open question's answer form. The first answer from any device wins, so
// one that lost the race comes back as an error here.
export function JobAskForm({ ask, project, jobId, onAnswered }: JobAskFormProps) {
  const [drafts, setDrafts] = useState<Record<string, JobAskDraft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instant = answersOnClick(ask);
  const { answers, missing } = draftAnswers(ask.questions, drafts);

  const settle = async (call: Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await call;
      onAnswered?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const send = (given: Record<string, JobAskAnswer>) =>
    void settle(AnswerJobQuestion(project, jobId, ask.id, given));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!instant && missing === null && !busy) send(answers);
      }}
      className="mt-2.5"
    >
      {ask.questions.map((q) => (
        <JobAskField
          key={q.id}
          question={q}
          draft={drafts[q.id] ?? EMPTY_ASK_DRAFT}
          onChange={(d) => setDrafts((all) => ({ ...all, [q.id]: d }))}
          onAnswer={instant ? (a) => send({ [q.id]: a }) : undefined}
          disabled={busy}
        />
      ))}
      <div className="mt-3 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-[var(--accent-red-text)]">{error}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void settle(DismissJobQuestion(project, jobId, ask.id))}
          title="Drop the question without answering it"
          className="shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors enabled:hover:bg-[var(--bg-hover)] enabled:hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          Dismiss
        </button>
        {!instant && (
          <button
            type="submit"
            disabled={busy || missing !== null}
            className="shrink-0 rounded-lg bg-[var(--text-primary)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            Send answer
          </button>
        )}
      </div>
    </form>
  );
}
