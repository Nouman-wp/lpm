import { relativeTime } from "../relativeTime";
import { isFailure, isWaiting, type NotificationEntry } from "./history";
import { ToastCopyButton } from "./ToastCopyButton";
import { errorCopyText } from "./toastText";
import type { ToastAction } from "./types";

const DOT: Record<NotificationEntry["kind"], string> = {
  default: "var(--text-muted)",
  loading: "var(--text-muted)",
  success: "var(--accent-green)",
  info: "var(--accent-blue)",
  warning: "var(--accent-amber)",
  error: "var(--accent-red)",
};

interface NotificationRowProps {
  entry: NotificationEntry;
  onAct: (entry: NotificationEntry, action: ToastAction) => void;
}

export function NotificationRow({ entry, onAct }: NotificationRowProps) {
  const dot = isWaiting(entry) ? "var(--accent-amber)" : DOT[entry.kind];
  const actions: ToastAction[] = entry.retry ? [{ label: "Retry", onClick: entry.retry }, ...entry.actions] : entry.actions;
  const failed = isFailure(entry);

  return (
    <li className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-[var(--bg-hover)]">
      <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate text-[13px] ${
              entry.read ? "text-[var(--text-secondary)]" : "font-medium text-[var(--text-primary)]"
            }`}
          >
            {entry.title}
          </span>
          {entry.count > 1 && <span className="shrink-0 text-[11px] text-[var(--text-muted)]">×{entry.count}</span>}
        </div>
        {(entry.tag || entry.description || entry.quote) && (
          <div className="truncate text-[12px] text-[var(--text-muted)]">
            {[entry.tag, entry.quote ?? entry.description].filter(Boolean).join(" · ")}
          </div>
        )}
        {(actions.length > 0 || failed) && (
          <div className="-ml-2 mt-0.5 flex flex-wrap items-center">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="toast-button toast-button-compact"
                onClick={() => onAct(entry, action)}
              >
                {action.label}
              </button>
            ))}
            {failed && <ToastCopyButton text={errorCopyText(entry.title, entry.description, entry.details)} />}
          </div>
        )}
      </div>
      <span className="mt-0.5 shrink-0 text-[11.5px] tabular-nums text-[var(--text-muted)]">
        {relativeTime(Math.floor(entry.at / 1000))}
      </span>
    </li>
  );
}
