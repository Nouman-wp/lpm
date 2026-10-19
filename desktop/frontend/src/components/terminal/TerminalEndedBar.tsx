import { RefreshIcon, XIcon } from "../icons";

interface TerminalEndedBarProps {
  targetLabel: string;
  // What the process exited with; null when the session went without a code.
  exitCode: number | null;
  // Absent where this window can't restart it (a tab on another Mac).
  onRestart?: () => void;
  onClose: () => void;
}

// Stands in for the composer once the terminal's process has ended: nothing
// typed here could reach it, so this says so and offers the two ways on.
export function TerminalEndedBar({ targetLabel, exitCode, onRestart, onClose }: TerminalEndedBarProps) {
  const how = exitCode === null ? "has ended" : `exited with code ${exitCode}`;
  return (
    <div
      role="status"
      className="terminal-surface flex items-center gap-2 border-t border-[var(--border)] bg-[var(--terminal-bg)] px-3 py-1.5 text-[12px]"
    >
      <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
        {targetLabel} {how} — it no longer takes input.
      </span>
      {onRestart && (
        <button
          type="button"
          onClick={onRestart}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-0.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <RefreshIcon />
          Restart
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <XIcon />
        Close tab
      </button>
    </div>
  );
}
