import { ChevronDown, ChevronUp } from "lucide-react";

// The model and level an agent's row in the + popup opens it with; a click
// unfolds the picker under the row.
export function LauncherModelChip({
  label,
  agentLabel,
  open,
  active,
  onToggle,
}: {
  label: string;
  agentLabel: string;
  open: boolean;
  active: boolean;
  onToggle: () => void;
}) {
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${agentLabel} model and level: ${label}`}
      // A click leaves the keyboard in the prompt.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      className={`flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border pl-2 pr-1.5 text-[11.5px] transition-colors ${
        open
          ? "border-[var(--text-muted)] bg-[var(--bg-active)] text-[var(--text-primary)]"
          : `border-[var(--border)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] ${
              active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            }`
      }`}
    >
      {label}
      <Chevron size={11} strokeWidth={2} className="shrink-0" />
    </button>
  );
}
