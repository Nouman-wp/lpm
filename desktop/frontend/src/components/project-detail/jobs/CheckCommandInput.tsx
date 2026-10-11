import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { TestJobCheck } from "../../../../bridge/commands";

type TestState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "work"; output?: string }
  | { kind: "nowork"; output?: string }
  | { kind: "error"; message: string };

// A check command in a row styled like the Command input, with a Test that
// tries it in `project` (undefined unless the job runs in exactly one) and
// what the try found underneath.
export function CheckCommandInput({
  value,
  project,
  autoFocus,
  disabled,
  onChange,
  onSubmit,
}: {
  value: string;
  project: string | undefined;
  autoFocus?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}) {
  const id = useId();
  const [test, setTest] = useState<TestState>({ kind: "idle" });
  // Bumped whenever the command or project changes, so a try still in flight
  // can't report on a command that is no longer there.
  const attempt = useRef(0);

  useEffect(() => {
    attempt.current += 1;
    setTest({ kind: "idle" });
  }, [project, value]);

  const runTest = async () => {
    if (!value.trim() || !project) return;
    const mine = ++attempt.current;
    setTest({ kind: "running" });
    try {
      const result = (await TestJobCheck(project, value)) as {
        work?: boolean;
        output?: string | null;
      };
      if (mine !== attempt.current) return;
      setTest({
        kind: result.work ? "work" : "nowork",
        output: result.output ?? undefined,
      });
    } catch (err) {
      if (mine !== attempt.current) return;
      setTest({
        kind: "error",
        // Tauri rejects with a plain string, so `err instanceof Error` is false
        // and would swallow the message the backend wrote.
        message: String(err) || "The check couldn't run.",
      });
    }
  };

  const running = test.kind === "running";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5 rounded-xl border border-transparent bg-[var(--bg-secondary)]/40 py-1.5 pl-4 pr-1.5 transition focus-within:border-[var(--accent-cyan)]/60">
        <label
          htmlFor={id}
          className="shrink-0 text-[12px] font-medium text-[var(--text-secondary)]"
        >
          Only if
        </label>
        <span aria-hidden className="h-4 w-px shrink-0 bg-[var(--border)]" />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="git fetch && git log HEAD..@{u} --oneline | grep ."
          autoFocus={autoFocus}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-w-0 flex-1 border-none bg-transparent py-1.5 font-mono text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={!value.trim() || !project || running || disabled}
          title={project ? undefined : "Pick a project to test the check."}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          {running ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Play size={10} fill="currentColor" />
          )}
          {running ? "Testing…" : "Test"}
        </button>
      </div>
      {(test.kind === "work" || test.kind === "nowork") && (
        <div role="status" className="px-1">
          <p
            className={`flex items-center gap-2 text-[12px] ${test.kind === "work" ? "text-[var(--accent-cyan)]" : "text-[var(--text-muted)]"}`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${test.kind === "work" ? "bg-[var(--accent-cyan)]" : "border border-[var(--text-muted)]"}`}
            />
            {test.kind === "work"
              ? "Would run — there's work to do."
              : "Nothing to do right now — this run would be skipped."}
          </p>
          {test.output && (
            <pre className="ml-3.5 mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-[var(--text-muted)]">
              {test.output}
            </pre>
          )}
        </div>
      )}
      {test.kind === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 px-1 text-[12px] leading-snug text-[var(--accent-red)]"
        >
          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-red)]" />
          {test.message}
        </p>
      )}
    </div>
  );
}
