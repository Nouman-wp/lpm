import { PlusIcon, XIcon } from "../../icons";

const CHIP_INPUT_CLASS =
  "border-none bg-transparent text-[13px] tabular-nums text-[var(--text-secondary)] outline-none transition-colors hover:text-[var(--text-primary)] focus:text-[var(--text-primary)]";

// The next time "Add time" offers: four hours after the last one, or noon when
// that would run past midnight.
function suggestNext(times: string[]): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(times[times.length - 1] ?? "");
  const h = m ? Number(m[1]) : 8;
  const next = h + 4 > 23 ? 12 : h + 4;
  return `${String(next).padStart(2, "0")}:${m ? m[2] : "00"}`;
}

// One or more fixed times of day, each its own chip.
export function TimeChips({
  times,
  onChange,
}: {
  times: string[];
  onChange: (times: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {times.map((time, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 rounded-lg bg-[var(--bg-secondary)] py-0.5 pl-2 pr-0.5"
        >
          <input
            type="time"
            aria-label="Run time"
            value={time}
            onChange={(e) =>
              onChange(times.map((t, j) => (j === i ? e.target.value : t)))
            }
            className={CHIP_INPUT_CLASS}
          />
          {times.length > 1 ? (
            <button
              type="button"
              aria-label={`Remove ${time}`}
              onClick={() => onChange(times.filter((_, j) => j !== i))}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] [&_svg]:h-3 [&_svg]:w-3"
            >
              <XIcon />
            </button>
          ) : (
            <span className="w-1.5" />
          )}
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange([...times, suggestNext(times)])}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-[var(--accent-cyan)] transition-colors hover:bg-[var(--accent-cyan)]/10 [&_svg]:h-3 [&_svg]:w-3"
      >
        <PlusIcon />
        Add time
      </button>
    </div>
  );
}
