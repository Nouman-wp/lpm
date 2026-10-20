import type { ReactNode } from "react";
import { Eye, Keyboard, TriangleAlert } from "lucide-react";
import { MACHINE as M } from "../../machineWords";

// What people let in from now on may do. Those already in keep theirs, and
// change one by one in the list below.
export function ShareAccessPicker({
  canType,
  disabled,
  onChange,
}: {
  canType: boolean;
  disabled?: boolean;
  onChange: (canType: boolean) => void;
}) {
  const option = (value: boolean, label: string, icon: ReactNode) => {
    const on = canType === value;
    const tone = on
      ? value
        ? "bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]"
        : "bg-[var(--bg-active)] text-[var(--text-primary)]"
      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]";
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(value)}
        className={`flex h-[34px] items-center justify-center gap-[7px] rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 ${tone}`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        People you let in can
      </div>
      <div
        role="radiogroup"
        aria-label="What people you let in can do"
        className="mt-2 grid grid-cols-2 gap-1.5 rounded-[10px] bg-[var(--bg-secondary)] p-[3px]"
      >
        {option(false, "Watch", <Eye size={14} />)}
        {option(true, "Watch and type", <Keyboard size={14} />)}
      </div>
      {canType && (
        <div className="mt-2 flex gap-2 rounded-lg bg-[var(--accent-amber)]/10 px-[11px] py-[9px] text-xs leading-[1.45] text-[var(--accent-amber)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          <span>
            They can run commands on {M.thisMachine} from this tab. You can take it back any time.
          </span>
        </div>
      )}
    </div>
  );
}
