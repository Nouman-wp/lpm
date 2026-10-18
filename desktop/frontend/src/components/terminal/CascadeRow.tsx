import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// One row of the + popup's agent ▸ model ▸ level menu. `cursor` is the menu's
// own highlight, from hover or the arrow keys; `checked` marks what the popup
// currently opens.
export function CascadeRow({
  label,
  sub,
  leading,
  checked,
  cursor,
  dim,
  more,
  onMouseEnter,
  onClick,
}: {
  label: string;
  sub?: string;
  leading?: ReactNode;
  checked: boolean;
  cursor: boolean;
  dim?: boolean;
  more?: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-md px-2 text-left text-[12.5px] leading-4 transition-colors duration-75 ${
        sub ? "py-1.5" : "py-[5px]"
      } ${cursor ? (dim ? "bg-[var(--bg-hover)]" : "bg-[var(--bg-active)]") : ""} ${
        checked
          ? "font-medium text-[var(--text-primary)]"
          : cursor
            ? "text-[var(--text-primary)]"
            : "text-[var(--text-secondary)]"
      }`}
    >
      <span
        aria-hidden
        className={`h-[7px] w-[7px] shrink-0 rounded-full border-[1.5px] ${sub ? "mt-[5px] self-start" : ""} ${
          checked
            ? "border-[var(--accent-cyan)] bg-[var(--accent-cyan)]"
            : "border-[var(--text-muted)] opacity-60"
        }`}
      />
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {sub && (
          <span className="mt-0.5 block text-[11px] font-normal leading-[14px] text-[var(--text-muted)]">
            {sub}
          </span>
        )}
      </span>
      {more && <ChevronRight size={12} className="shrink-0 text-[var(--text-muted)]" />}
    </button>
  );
}
