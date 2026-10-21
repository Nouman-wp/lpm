import { useState } from "react";
import { useNow } from "../../../hooks/useNow";
import { AnswerJobQuestion, DismissJobQuestion } from "../../../../bridge/commands";
import {
  answersOnClick,
  askDeadlineNote,
  draftAnswers,
  EMPTY_ASK_DRAFT,
  type JobAsk,
  type JobAskAnswer,
  type JobAskDraft,
} from "../../../jobAsk";
import { JobAskField } from "./JobAskField";
import { SHEET_BUTTON } from "./jobAskSheet";

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
  const now = useNow(ask.expiresAt !== undefined, 60_000);
  const deadline = askDeadlineNote(ask, now);
  const instant = answersOnClick(ask);
  const lead = ask.questions.length === 1;
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
        if (missing === null && !busy) send(answers);
      }}
    >
      {ask.questions.map((q) => (
        <JobAskField
          key={q.id}
          question={q}
          lead={lead}
          draft={drafts[q.id] ?? EMPTY_ASK_DRAFT}
          onChange={(d) => setDrafts((all) => ({ ...all, [q.id]: d }))}
          onAnswer={instant ? (a) => send({ [q.id]: a }) : undefined}
          disabled={busy}
        />
      ))}
      {!instant && (
        <button type="submit" disabled={busy || missing !== null} className={`${SHEET_BUTTON.fill} mt-4`}>
          {lead ? "Send answer" : "Send answers"}
        </button>
      )}
      {error && <p className="mt-2.5 text-[11.5px] leading-snug text-[var(--accent-red-text)]">{error}</p>}
      <div className="mt-3 flex flex-col items-center gap-1 text-center">
        {deadline && <p className="text-[11.5px] text-[var(--text-muted)]">{deadline}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void settle(DismissJobQuestion(project, jobId, ask.id))}
          title="Close the question without an answer"
          className="rounded-md px-2.5 py-1 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors enabled:hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          Skip question
        </button>
      </div>
    </form>
  );
}
