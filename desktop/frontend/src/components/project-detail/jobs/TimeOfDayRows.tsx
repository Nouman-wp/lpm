import { RowSelect } from "./RowSelect";
import { TimeChips } from "./TimeChips";
import { Row, RowNumber, TIME_INPUT_CLASS } from "./JobFormRows";
import type { JobDraft } from "../../../jobsFormat";

// When in the day a calendar job runs: one or more set times, or a window the
// time is drawn from fresh each day.
export function TimeOfDayRows({
  draft,
  patch,
}: {
  draft: JobDraft;
  patch: (values: Partial<JobDraft>) => void;
}) {
  return (
    <>
      <Row label="Time">
        <RowSelect
          value={draft.randomWindow ? "window" : "fixed"}
          onChange={(v) => patch({ randomWindow: v === "window" })}
          options={[
            { value: "fixed", label: "Set times" },
            { value: "window", label: "A random time in a window" },
          ]}
        />
      </Row>
      {draft.randomWindow ? (
        <>
          <Row label="Between">
            <span className="flex items-center gap-2">
              <input
                type="time"
                aria-label="From"
                value={draft.time}
                onChange={(e) => patch({ time: e.target.value })}
                className={TIME_INPUT_CLASS}
              />
              <span className="text-[13px] text-[var(--text-muted)]">and</span>
              <input
                type="time"
                aria-label="Until"
                value={draft.untilTime}
                onChange={(e) => patch({ untilTime: e.target.value })}
                className={TIME_INPUT_CLASS}
              />
            </span>
          </Row>
          <Row label="Runs">
            <span className="flex items-center gap-2">
              <RowNumber
                value={draft.timesPerDay}
                min={1}
                onChange={(timesPerDay) => patch({ timesPerDay })}
              />
              <span className="text-[13px] text-[var(--text-muted)]">a day</span>
            </span>
          </Row>
        </>
      ) : (
        <Row label="At" alignTop>
          <TimeChips
            times={[draft.time, ...draft.moreTimes]}
            onChange={(times) => patch({ time: times[0] ?? "", moreTimes: times.slice(1) })}
          />
        </Row>
      )}
    </>
  );
}
