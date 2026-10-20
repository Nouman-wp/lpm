import type { ReactNode } from "react";
import { ChevronRightIcon } from "../icons";
import { TILE_STYLE } from "./styles";

/** A machine a new device can pair with, picked to show its pairing code. */
export function PairTargetRow({
  icon,
  label,
  detail,
  busy,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors enabled:hover:bg-[var(--bg-hover)] ${busy ? "" : "disabled:opacity-60"}`}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={TILE_STYLE[disabled && !busy ? "idle" : "live"]}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{label}</p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">{busy ? "Preparing a code…" : detail}</p>
      </div>
      <span className="flex shrink-0 text-[var(--text-muted)]">
        <ChevronRightIcon />
      </span>
    </button>
  );
}
