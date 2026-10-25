import type { UsageMeter } from "../../../sidebarUsage";
import { AccountMeters } from "../../AccountMeters";
import { CheckIcon } from "../../icons";

// One choice in the Claude account menu: a check on the one in use, a note
// beside it, and the account's 5-hour and weekly usage under it.
export function JobAccountRow({
  label,
  detail,
  meters = [],
  active,
  onClick,
}: {
  label: string;
  detail?: string;
  meters?: UsageMeter[];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      onClick={onClick}
      className={`flex w-full flex-col gap-1 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)] ${
        active
          ? "text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span className="flex w-full items-center gap-2">
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[var(--accent-cyan)] [&_svg]:h-3.5 [&_svg]:w-3.5">
          {active && <CheckIcon />}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {detail && <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{detail}</span>}
      </span>
      {meters.length > 0 && <AccountMeters meters={meters} className="pl-[22px]" />}
    </button>
  );
}
