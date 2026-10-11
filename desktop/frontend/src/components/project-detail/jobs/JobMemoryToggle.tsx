import { BrainIcon } from "../../icons";
import { Tooltip } from "../../ui/Tooltip";

// Whether each run of an AI prompt job picks up where the earlier ones left off.
// A read-only run can't save what it did, so it has nothing to remember.
export function JobMemoryToggle({
  value,
  readOnly,
  onChange,
}: {
  value: boolean;
  readOnly: boolean;
  onChange: (value: boolean) => void;
}) {
  const on = value && !readOnly;
  const hint = readOnly
    ? "A read-only run can't save what it did, so each run starts fresh"
    : on
      ? "Each run reads what earlier runs did and found, then adds its own"
      : "Each run starts fresh, without what earlier runs did";
  return (
    <Tooltip content={hint} side="bottom">
      <button
        type="button"
        onClick={() => onChange(!value)}
        disabled={readOnly}
        aria-pressed={on}
        aria-label="Remember earlier runs"
        className={`flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/40 px-2.5 py-1.5 text-[12.5px] transition-colors disabled:cursor-default disabled:opacity-50 enabled:hover:bg-[var(--bg-hover)] enabled:hover:text-[var(--text-primary)] ${
          on ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
        }`}
      >
        <span className={on ? "text-[var(--accent-cyan-text)]" : "text-[var(--text-muted)]"}>
          <BrainIcon size={13} />
        </span>
        Memory
      </button>
    </Tooltip>
  );
}
