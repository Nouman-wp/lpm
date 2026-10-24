import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { FOOTER_TOASTER_ID } from "../toasterOffset";

interface UndoCloseToastProps {
  toastId: string;
  title: string;
  detail?: string;
  durationMs: number;
  onUndo: () => void;
}

export function UndoCloseToast({ toastId, title, detail, durationMs, onUndo }: UndoCloseToastProps) {
  // Countdown line drains from full to empty over the undo window: paint it full
  // on mount, then flip to 0 on the next frame so the width transition runs.
  const [drained, setDrained] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrained(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="group relative flex w-max min-w-[300px] max-w-[356px] items-center gap-2 overflow-hidden rounded-[11px] border border-[var(--border)] py-1.5 pl-3.5 pr-2 shadow-lg backdrop-blur-md"
      style={{ backgroundColor: "color-mix(in srgb, var(--bg-primary) 88%, transparent)" }}
    >
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">
        {title}
        {detail && <span className="text-[var(--text-muted)]"> · {detail}</span>}
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-[var(--accent-blue)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={() => toast.dismiss(toastId)}
        aria-label="Dismiss"
        className="flex shrink-0 items-center justify-center rounded-md p-1 text-[var(--text-muted)] opacity-0 transition-[opacity,color,background-color] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] group-hover:opacity-100"
      >
        <X size={13} />
      </button>
      <span
        className="pointer-events-none absolute bottom-0 left-0 h-px ease-linear"
        style={{
          width: drained ? "0%" : "100%",
          transitionProperty: "width",
          transitionDuration: `${durationMs}ms`,
          backgroundColor: "color-mix(in srgb, var(--text-muted) 40%, transparent)",
        }}
      />
    </div>
  );
}

export function showUndoCloseToast(opts: {
  toastId: string;
  title: string;
  detail?: string;
  durationMs: number;
  onUndo: () => void;
  onFinalize: () => void;
}) {
  toast.custom(
    () => (
      <UndoCloseToast
        toastId={opts.toastId}
        title={opts.title}
        detail={opts.detail}
        durationMs={opts.durationMs}
        onUndo={opts.onUndo}
      />
    ),
    {
      id: opts.toastId,
      duration: opts.durationMs,
      toasterId: FOOTER_TOASTER_ID,
      onAutoClose: opts.onFinalize,
      onDismiss: opts.onFinalize,
    },
  );
}
