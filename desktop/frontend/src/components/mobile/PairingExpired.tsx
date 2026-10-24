import { TimerOff } from "lucide-react";
import { PRIMARY_BUTTON, QUIET_BUTTON } from "./styles";

/** A code that stopped working, with a fresh one a click away. */
export function PairingExpired({
  title,
  busy,
  onNewCode,
  onClose,
}: {
  title: string;
  busy?: boolean;
  onNewCode?: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <div className="mt-4 flex flex-col items-center py-6 text-center">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent-amber) 16%, transparent)",
            color: "var(--accent-amber-text)",
          }}
        >
          <TimerOff size={18} />
        </div>
        <p className="mt-3 text-sm font-semibold" style={{ color: "var(--accent-amber-text)" }}>
          Code expired
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Codes last 10 minutes and work once.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {onNewCode ? (
          <>
            <button onClick={onClose} className={QUIET_BUTTON}>
              Close
            </button>
            <button onClick={onNewCode} disabled={busy} className={PRIMARY_BUTTON}>
              New code
            </button>
          </>
        ) : (
          <button onClick={onClose} className={PRIMARY_BUTTON}>
            Done
          </button>
        )}
      </div>
    </>
  );
}
