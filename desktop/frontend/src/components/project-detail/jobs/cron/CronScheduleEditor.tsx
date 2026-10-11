import { useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  CRON_FIELDS,
  CRON_FIELD_INFO,
  cronFieldAt,
  cronTokenRange,
  cronTokens,
  normalizeCron,
  parseCron,
  withCronField,
  type CronField,
  type CronSpec,
} from "../../../../cronExpr";
import { describeCron, listPhrase, ordinal } from "../../../../cronDescribe";
import { CronFieldGuideCard } from "./CronFieldGuideCard";
import { CronNextRunsCard } from "./CronNextRunsCard";
import { CronDescribeBox, type CronAIContext } from "./CronDescribeBox";

// Dates of the month a run can fall on that some months don't have, when the
// date alone decides the day.
function shortMonthNote(spec: CronSpec): string {
  if (spec.sets.dow.size !== 7 || spec.sets.dom.size === 31) return "";
  const late = [...spec.sets.dom].filter((d) => d > 28).sort((a, b) => a - b);
  if (late.length === 0) return "";
  const dates = listPhrase(late.map(ordinal)).replace(/ and (?=\S+$)/, " or ");
  return ` Months without the ${dates} skip ${late.length === 1 ? "that run" : "those runs"}.`;
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

// A cron line typed straight in and read back as a sentence, the words the
// field under the caret controls lit up. The fields, what each takes and the
// runs the line makes fold away until asked for. Or said in words for the
// default agent to write.
export function CronScheduleEditor({
  value,
  onChange,
  ai,
}: {
  value: string;
  onChange: (cron: string) => void;
  ai: CronAIContext;
}) {
  const [active, setActive] = useState<CronField>("hour");
  const [details, setDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseCron(value), [value]);
  const spec = parsed.ok ? parsed.spec : null;
  const tokens = cronTokens(value) ?? normalizeCron(value).split(" ").filter(Boolean);
  const zone = useMemo(timeZone, []);

  const track = (el: HTMLInputElement) => {
    const field = cronFieldAt(el.value, el.selectionStart ?? el.value.length);
    if (field) setActive(field);
  };

  const pick = (field: CronField) => {
    setActive(field);
    const range = cronTokenRange(value, field);
    const el = inputRef.current;
    if (!el || !range) return;
    el.focus();
    el.setSelectionRange(range[0], range[1]);
  };

  return (
    <div>
      <p
        aria-live="polite"
        className="flex min-h-[64px] items-center justify-center px-4 text-center text-[22px] font-medium leading-snug tracking-tight text-[var(--text-primary)]"
      >
        {spec ? (
          <span>
            <span className="text-[var(--text-muted)]">“</span>
            {describeCron(spec).map((seg, i) => (
              <span
                key={i}
                className={
                  seg.field === active
                    ? "rounded-[4px] bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan-text)] ring-[3px] ring-[var(--accent-cyan)]/15"
                    : undefined
                }
              >
                {seg.text}
              </span>
            ))}
            .<span className="text-[var(--text-muted)]">”</span>
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">Fix the cron line to see when it runs</span>
        )}
      </p>

      <input
        ref={inputRef}
        aria-label="Cron line"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          track(e.target);
        }}
        onSelect={(e) => track(e.currentTarget)}
        placeholder="0 18 * * 5"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={`mt-2 h-16 w-full rounded-xl bg-[var(--bg-secondary)]/40 px-5 text-center font-mono text-[28px] tracking-[0.08em] text-[var(--text-primary)] outline-none ring-[1.5px] ring-inset transition placeholder:text-[var(--text-muted)] ${
          spec
            ? "ring-[var(--accent-cyan)]/30 focus:ring-[var(--accent-cyan)]/60"
            : "ring-[var(--accent-red)]/60"
        }`}
      />
      {!parsed.ok && (
        <p className="mt-2 px-2 text-center text-[12px] leading-snug text-[var(--accent-red-text)]">
          {parsed.error}
        </p>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setDetails((v) => !v)}
          aria-expanded={details}
          className="flex items-center gap-1 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
        >
          <ChevronRight size={12} className={`transition-transform ${details ? "rotate-90" : ""}`} />
          Field guide and next runs
        </button>
        {details && (
          <div className="mt-2">
            <div role="group" aria-label="Cron fields" className="flex flex-wrap justify-center gap-1">
              {CRON_FIELDS.map((field, i) => {
                const bad = !parsed.ok && parsed.field === field;
                const on = field === active;
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => pick(field)}
                    aria-pressed={on}
                    className={`flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                      bad
                        ? "bg-[var(--accent-red)]/10 text-[var(--accent-red-text)]"
                        : on
                          ? "bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan-text)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    <span className="font-mono font-semibold">{tokens[i] ?? "?"}</span>
                    <span>{CRON_FIELD_INFO[field].label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 px-2 text-center text-[12px] leading-snug text-[var(--text-muted)]">
              minute · hour · day of month · month · day of week — click a field to see what it takes
            </p>
            <div className="mt-3 grid grid-cols-2 items-start gap-3">
              <CronFieldGuideCard
                field={active}
                onUse={(token) => onChange(withCronField(value, active, token))}
              />
              <CronNextRunsCard spec={spec} />
            </div>
            <p className="mt-2 px-1 text-[12px] leading-snug text-[var(--text-muted)]">
              Runs on local time{zone && ` (${zone})`}.{spec && shortMonthNote(spec)}
            </p>
          </div>
        )}
      </div>

      <CronDescribeBox value={value} onChange={onChange} ai={ai} />
    </div>
  );
}
