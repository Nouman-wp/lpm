import type { ReactNode } from "react";

// One choice of a wrapping set, such as a model or level in the + popup.
export function ChoicePill({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      // A click leaves the keyboard in the prompt.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-6 rounded-md border px-2 text-[11.5px] transition-colors ${
        checked
          ? "border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/12 text-[var(--text-primary)]"
          : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}
