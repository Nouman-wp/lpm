import { RefreshIcon, StopIcon } from "../icons";
import { Tooltip } from "../ui/Tooltip";

interface ServiceColumnActionsProps {
  name: string;
  ports: number[];
  exited: boolean;
  onRestart: () => void;
  onStop: () => void;
}

const BUTTON =
  "flex items-center rounded p-0.5 text-[var(--terminal-header-text)] transition-colors hover:bg-[var(--terminal-header-hover)] hover:text-[var(--terminal-tab-active)] [&>svg]:h-3 [&>svg]:w-3";

// The right end of a service's column header in the All view: where it
// listens, and restart/stop without leaving the view.
export function ServiceColumnActions({ name, ports, exited, onRestart, onStop }: ServiceColumnActionsProps) {
  return (
    <>
      {!exited && ports.length > 0 && (
        <span className="mr-1 tabular-nums opacity-70">{ports.map((p) => `:${p}`).join(" ")}</span>
      )}
      <Tooltip content={`Restart ${name}`} side="bottom" align="end">
        <button type="button" onClick={onRestart} aria-label={`Restart ${name}`} className={BUTTON}>
          <RefreshIcon />
        </button>
      </Tooltip>
      {!exited && (
        <Tooltip content={`Stop ${name}`} side="bottom" align="end">
          <button type="button" onClick={onStop} aria-label={`Stop ${name}`} className={BUTTON}>
            <StopIcon />
          </button>
        </Tooltip>
      )}
    </>
  );
}
