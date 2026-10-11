import { SegmentedControl } from "../../ui/SegmentedControl";
import { MonthDayGrid } from "./MonthDayGrid";
import { RowSelect } from "./RowSelect";
import { Row } from "./JobFormRows";
import type { JobDraft } from "../../../jobsFormat";
import { NTH_WORDS, nthOfLabel, type NthOf, type NthWord } from "../../../jobsScheduleRules";
import { WEEKDAYS } from "../../../weekdays";

const NTH_OF: NthOf[] = [...WEEKDAYS, "day", "weekday"];

// Which days of the month a monthly job runs on: picked dates, or a position
// such as "the first Monday".
export function MonthlyRows({
  draft,
  patch,
}: {
  draft: JobDraft;
  patch: (values: Partial<JobDraft>) => void;
}) {
  const byDates = draft.dayRule === "dates";
  const shortDate = draft.monthDates.some((d) => d > 28);

  return (
    <>
      <Row label="Pick by">
        <SegmentedControl
          variant="subtle"
          ariaLabel="Pick by"
          value={draft.dayRule === "nth" ? "nth" : "dates"}
          onChange={(dayRule) => patch({ dayRule })}
          options={[
            { value: "dates", label: "Dates" },
            { value: "nth", label: "Day of week" },
          ]}
        />
      </Row>
      {byDates ? (
        <>
          <Row label="On" alignTop>
            <MonthDayGrid
              dates={draft.monthDates}
              last={draft.lastDay}
              onChange={({ dates, last }) => patch({ monthDates: dates, lastDay: last })}
            />
          </Row>
          {shortDate && (
            <Row label="In shorter months">
              <RowSelect
                value={draft.shortMonths}
                onChange={(v) => patch({ shortMonths: v as JobDraft["shortMonths"] })}
                options={[
                  { value: "skip", label: "Skip that month" },
                  { value: "last", label: "Run on the last day" },
                ]}
              />
            </Row>
          )}
        </>
      ) : (
        <Row label="On the">
          <span className="flex items-center gap-1">
            <RowSelect
              value={draft.nth}
              onChange={(v) => patch({ nth: v as NthWord })}
              options={NTH_WORDS.map((w) => ({ value: w, label: w }))}
            />
            <RowSelect
              value={draft.nthOf}
              onChange={(v) => patch({ nthOf: v as NthOf })}
              options={NTH_OF.map((of) => ({ value: of, label: nthOfLabel(of) }))}
            />
            <span className="text-[13px] text-[var(--text-muted)]">of the month</span>
          </span>
        </Row>
      )}
    </>
  );
}
