import { SegmentedControl } from "../../ui/SegmentedControl";
import { WeekdayPicker } from "./WeekdayPicker";
import { RowSelect } from "./RowSelect";
import { MonthlyRows } from "./MonthlyRows";
import { IntervalRows } from "./IntervalRows";
import { TimeOfDayRows } from "./TimeOfDayRows";
import { NextRunsPreview } from "./NextRunsPreview";
import { CronEquivalentLine } from "./CronEquivalentLine";
import { Card, GroupLabel, Row, TIME_INPUT_CLASS } from "./JobFormRows";
import type { JobDraft } from "../../../jobsFormat";
import { REPEAT_OPTIONS, repeatOf, repeatPatch } from "../../../jobsRepeat";

// "1 random day a week", "2 random days a week" … up to one short of the pool,
// since picking all of them is what "all of them" already means.
function pickOptions(pool: number): { value: string; label: string }[] {
  const options = [{ value: "0", label: "All of them" }];
  for (let n = 1; n < pool; n++) {
    options.push({
      value: String(n),
      label: `${n} random day${n === 1 ? "" : "s"} a week`,
    });
  }
  return options;
}

// When the job runs: how often it repeats, which days, and — for a job that
// runs at a time of day — set times or a window the time is drawn from.
export function JobFrequencyCard({
  draft,
  patch,
  summary,
}: {
  draft: JobDraft;
  patch: (values: Partial<JobDraft>) => void;
  summary: string;
}) {
  const repeat = repeatOf(draft);
  const atTime = draft.scheduleMode === "time";
  const byWeek = repeat === "daily" || repeat === "weekly";
  // The days a random pick draws from: the ones selected, or all seven.
  const dayPool = draft.days.length === 0 ? 7 : draft.days.length;
  const picked = draft.randomDays ? Math.min(draft.pickDays, dayPool) : 0;

  return (
    <div>
      <GroupLabel>When</GroupLabel>
      <Card>
        <Row label="Repeat">
          <SegmentedControl
            variant="subtle"
            ariaLabel="Repeat"
            value={repeat}
            onChange={(next) => patch(repeatPatch(draft, next))}
            options={REPEAT_OPTIONS}
          />
        </Row>
        {repeat === "weekly" && (
          <Row label="On" alignTop>
            <WeekdayPicker
              value={draft.days}
              onChange={(days) => patch({ days })}
            />
          </Row>
        )}
        {repeat === "monthly" && <MonthlyRows draft={draft} patch={patch} />}
        {repeat === "once" && (
          <Row label="On">
            <input
              type="date"
              aria-label="Date"
              value={draft.onceDate}
              onChange={(e) => patch({ onceDate: e.target.value })}
              className={TIME_INPUT_CLASS}
            />
          </Row>
        )}
        {byWeek && dayPool > 1 && (
          <Row label="Use">
            <RowSelect
              value={String(picked)}
              onChange={(v) => {
                const n = Number(v);
                patch(
                  n === 0
                    ? { randomDays: false }
                    : { randomDays: true, pickDays: n },
                );
              }}
              options={pickOptions(dayPool)}
            />
          </Row>
        )}
        {repeat === "interval" && <IntervalRows draft={draft} patch={patch} />}
        {atTime && <TimeOfDayRows draft={draft} patch={patch} />}
      </Card>
      {summary && (
        <p className="mt-2 text-[12px] text-[var(--text-muted)]">
          {summary}.
          {atTime &&
            !draft.randomWindow &&
            " It starts within a few minutes of that time, so automations set to the same hour don't all begin at once."}
          {atTime &&
            draft.randomWindow &&
            " The time inside the window is picked for you and changes each day."}
          {repeat === "monthly" &&
            draft.dayRule === "dates" &&
            draft.monthDates.some((d) => d > 28) &&
            (draft.shortMonths === "last"
              ? " Months without that date run on their last day instead."
              : " Months without that date are skipped.")}
          {repeat === "once" && " After that it stays in the list until you remove it."}
          {repeat === "interval" &&
            draft.varyInterval &&
            " The gap is picked fresh after every run."}
          {repeat === "interval" &&
            (draft.intervalWindow || draft.intervalDays.length > 0) &&
            " Outside those hours it waits, and starts again when they open."}
        </p>
      )}
      {repeat !== "manual" && (
        <>
          <NextRunsPreview draft={draft} />
          <CronEquivalentLine draft={draft} />
        </>
      )}
    </div>
  );
}
