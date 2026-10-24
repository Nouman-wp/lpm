import { AIButton } from "./ui/AIButton";

interface ConfigProblemNoticeProps {
  message: string;
  // The first line the message names, when it names one.
  goTo?: { line: number; onClick: () => void };
  // Absent when no AI CLI is installed.
  fix?: { fixing: boolean; onFix: () => void; onCancel: () => void };
}

// What's wrong with the config being edited, with a way to the line and an AI
// fix of it.
export function ConfigProblemNotice({ message, goTo, fix }: ConfigProblemNoticeProps) {
  return (
    <div
      role="alert"
      className="flex max-w-[420px] flex-col gap-2 rounded-lg border border-[var(--accent-red)]/30 bg-[var(--bg-primary)] px-3 py-2 shadow-lg"
    >
      <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[var(--accent-red-text)]">{message}</p>
      {(goTo || fix) && (
        <div className="flex items-center gap-2">
          {goTo && (
            <button
              type="button"
              onClick={goTo.onClick}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              Go to line {goTo.line}
            </button>
          )}
          {fix && (
            <AIButton onClick={fix.onFix} onCancel={fix.onCancel} loading={fix.fixing} title="Fix this problem with AI">
              {fix.fixing ? "Fixing…" : "Fix with AI"}
            </AIButton>
          )}
        </div>
      )}
    </div>
  );
}
