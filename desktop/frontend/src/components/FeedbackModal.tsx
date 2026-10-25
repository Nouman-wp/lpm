import { useEffect, useState, type KeyboardEvent } from "react";
import { Check, CircleDot, ExternalLink, MessagesSquare } from "lucide-react";
import { BrowserOpenURL } from "../../bridge/runtime";
import { GetPlatform, GetVersion } from "../../bridge/commands";
import { useAppStore } from "../store/app";
import { FeedbackLessonsRail } from "./FeedbackLessonsRail";
import { XIcon } from "./icons";
import { Modal } from "./ui/Modal";
import { newDiscussionUrl, newIssueUrl } from "../githubIssue";
import { feedbackTitle, guessFeedbackKind, type FeedbackKind } from "./feedbackDraft";

interface KindOption {
  value: FeedbackKind;
  title: string;
  target: "issue" | "discussion";
  hint: string;
  url: (title: string, body: string) => string;
}

// Bugs are work to track, so they become issues; ideas and questions are a
// conversation others can join, upvote or answer, so they become discussions.
const KINDS: KindOption[] = [
  {
    value: "bug",
    title: "Bug",
    target: "issue",
    hint: "Bugs open a GitHub issue, where the fix is tracked",
    url: (title, body) => newIssueUrl({ title, body, labels: ["bug"] }),
  },
  {
    value: "suggestion",
    title: "Idea",
    target: "discussion",
    hint: "Ideas start a GitHub discussion others can upvote",
    url: (title, body) => newDiscussionUrl({ title, body, category: "ideas" }),
  },
  {
    value: "question",
    title: "Question",
    target: "discussion",
    hint: "Questions start a Q&A discussion anyone can answer",
    url: (title, body) => newDiscussionUrl({ title, body, category: "q-a" }),
  },
];

const SUBMIT_LABEL = { issue: "Open GitHub issue", discussion: "Start GitHub discussion" };

export function FeedbackModal() {
  const open = useAppStore((state) => state.feedbackOpen);
  const setFeedbackOpen = useAppStore((state) => state.setFeedbackOpen);
  const [text, setText] = useState("");
  // The user's own pick; until there is one, the kind follows the text.
  const [picked, setPicked] = useState<FeedbackKind | null>(null);
  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState("");

  const onClose = () => setFeedbackOpen(false);

  useEffect(() => {
    if (!open) {
      setText("");
      setPicked(null);
      return;
    }
    GetVersion().then(setVersion).catch(() => setVersion(""));
    GetPlatform().then(setPlatform).catch(() => setPlatform(""));
  }, [open]);

  const kind = picked ?? guessFeedbackKind(text);
  const option = KINDS.find((candidate) => candidate.value === kind);
  const title = feedbackTitle(text);
  const isValid = !!option && title.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const footer = `\n\n---\nlpm ${version || "dev"} · ${platform || navigator.platform}`;
    BrowserOpenURL(option.url(title, text.trim() + footer));
    onClose();
  };

  const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      backdropClassName="bg-black/50 backdrop-blur-sm"
      contentClassName="w-[min(880px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
    >
      <div className="flex max-h-[min(760px,calc(100vh-48px))] flex-col overflow-y-auto md:flex-row">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
          onKeyDown={handleFormKeyDown}
          className="flex flex-col md:w-[560px] md:shrink-0"
        >
          <div className="pb-5 pl-6 pr-14 pt-6 md:pr-6">
            <h2 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
              Send feedback
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
              Share a bug, idea, or question with the lpm team.
            </p>
          </div>

          <div className="flex-1 px-6 pb-6">
            <label
              htmlFor="feedback-text"
              className="mb-1.5 block text-[11px] font-medium text-[var(--text-secondary)]"
            >
              What's on your mind?
            </label>
            <textarea
              id="feedback-text"
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="What happened, what you'd like, or what you want to know…"
              rows={6}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 text-[12px] leading-relaxed text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--text-secondary)] md:h-[256px]"
            />

            <div role="group" aria-label="Feedback type" className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] text-[var(--text-muted)]">Sounds like</span>
              {KINDS.map((choice) => {
                const selected = kind === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => setPicked(choice.value)}
                    aria-pressed={selected}
                    title={choice.hint}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11px] font-medium transition-colors ${
                      selected
                        ? "border-[var(--text-secondary)] bg-[var(--bg-active)] text-[var(--text-primary)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {selected && <Check size={10} strokeWidth={2.6} />}
                    {choice.title}
                  </button>
                );
              })}
            </div>

            {title && (
              <p className="mt-3.5 truncate text-[11px] text-[var(--text-muted)]">
                Title: <span className="text-[var(--text-secondary)]">{title}</span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]/40 px-6 py-4">
            <p className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              {option?.target === "issue" && <CircleDot size={12} strokeWidth={2} className="shrink-0" />}
              {option?.target === "discussion" && (
                <MessagesSquare size={12} strokeWidth={2} className="shrink-0" />
              )}
              {option?.hint ?? "Bugs open a GitHub issue; ideas and questions start a GitHub discussion"}
            </p>
            <button
              type="submit"
              disabled={!isValid}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3.5 py-2 text-[11px] font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {option ? SUBMIT_LABEL[option.target] : "Open on GitHub"}
              <ExternalLink size={12} strokeWidth={2} />
            </button>
          </div>
        </form>
        <FeedbackLessonsRail />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <XIcon />
      </button>
    </Modal>
  );
}
