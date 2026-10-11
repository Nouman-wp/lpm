import { ordinal } from "../../../jobsScheduleRules";

const ON =
  "bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] ring-1 ring-inset ring-[var(--accent-cyan)]/30";
const OFF =
  "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]";

const DATES = Array.from({ length: 31 }, (_, i) => i + 1);

// Dates of the month as a 7-column grid, with "Last day" filling the row the
// 31st leaves open.
export function MonthDayGrid({
  dates,
  last,
  onChange,
}: {
  dates: number[];
  last: boolean;
  onChange: (value: { dates: number[]; last: boolean }) => void;
}) {
  const toggle = (n: number) =>
    onChange({
      dates: dates.includes(n)
        ? dates.filter((d) => d !== n)
        : [...dates, n].sort((a, b) => a - b),
      last,
    });

  return (
    <div className="grid w-[280px] grid-cols-7 gap-1">
      {DATES.map((n) => {
        const on = dates.includes(n);
        return (
          <button
            key={n}
            type="button"
            onClick={() => toggle(n)}
            aria-pressed={on}
            aria-label={`The ${ordinal(n)}`}
            className={`h-8 rounded-md text-[12px] font-medium tabular-nums transition-colors ${on ? ON : OFF}`}
          >
            {n}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange({ dates, last: !last })}
        aria-pressed={last}
        className={`col-span-4 h-8 rounded-md text-[12px] font-medium transition-colors ${last ? ON : OFF}`}
      >
        Last day
      </button>
    </div>
  );
}
