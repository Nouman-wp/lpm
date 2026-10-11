import { CheckIcon } from "../../icons";

// One option in a row picker's menu, with a check on the selection.
export function RowMenuItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)] ${
        active
          ? "text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[var(--accent-cyan)] [&_svg]:h-3.5 [&_svg]:w-3.5">
        {active && <CheckIcon />}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
