import { RefreshIcon } from "../icons";
import { serviceCrashed, serviceExitText } from "../../serviceExit";

interface ServiceExitBarProps {
  name: string;
  exitCode: number | null;
  onRestart: () => void;
}

// Under a service whose command has ended. The pane alone can't tell a crash
// from a server that is just quiet, so this says which, and runs it again.
export function ServiceExitBar({ name, exitCode, onRestart }: ServiceExitBarProps) {
  const crashed = serviceCrashed({ exited: true, exitCode });
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[12px]"
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          crashed ? "bg-[var(--accent-red)]" : "bg-[var(--text-muted)]"
        }`}
      />
      <span
        className={`min-w-0 flex-1 truncate ${
          crashed ? "text-[var(--accent-red-text)]" : "text-[var(--text-secondary)]"
        }`}
      >
        <span className="font-mono">{name}</span> {serviceExitText({ exitCode })}
      </span>
      <button
        type="button"
        onClick={onRestart}
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        <RefreshIcon />
        Restart
      </button>
    </div>
  );
}
