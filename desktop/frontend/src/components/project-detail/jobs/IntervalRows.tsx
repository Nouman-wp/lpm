import { RowSelect } from "./RowSelect";
import { WeekdayPicker } from "./WeekdayPicker";
import { Row, RowNumber, TIME_INPUT_CLASS } from "./JobFormRows";
import type { IntervalUnit, JobDraft } from "../../../jobsFormat";

const WORKDAYS: JobDraft["intervalDays"] = ["mon", "tue", "wed", "thu", "fri"];

// An interval job: its gap (fixed or drawn from a range), and the hours and
// days it is held to.
export function IntervalRows({
  draft,
  patch,
}: {
  draft: JobDraft;
  patch: (values: Partial<JobDraft>) => void;
}) {
  const someDays = draft.intervalDays.length > 0;

  return (
    <>
      <Row label="Gap">
        <RowSelect
          value={draft.varyInterval ? "vary" : "fixed"}
          onChange={(v) =>
            patch({
              varyInterval: v === "vary",
              intervalMaxValue: Math.max(draft.intervalMaxValue, draft.intervalValue),
            })
          }
          options={[
            { value: "fixed", label: "Always the same" },
            { value: "vary", label: "Varies within a range" },
          ]}
        />
      </Row>
      <Row label={draft.varyInterval ? "Between" : "Every"}>
        <span className="flex items-center gap-2">
          <RowNumber
            value={draft.intervalValue}
            min={1}
            onChange={(intervalValue) =>
              patch({
                intervalValue,
                intervalMaxValue: Math.max(draft.intervalMaxValue, intervalValue),
              })
            }
          />
          {draft.varyInterval && (
            <>
              <span className="text-[13px] text-[var(--text-muted)]">and</span>
              <RowNumber
                value={draft.intervalMaxValue}
                min={draft.intervalValue}
                onChange={(intervalMaxValue) => patch({ intervalMaxValue })}
              />
            </>
          )}
          <RowSelect
            value={draft.intervalUnit}
            onChange={(u) => patch({ intervalUnit: u as IntervalUnit })}
            options={[
              { value: "minutes", label: "minutes" },
              { value: "hours", label: "hours" },
              { value: "days", label: "days" },
            ]}
          />
        </span>
      </Row>
      <Row label="Hours">
        <RowSelect
          value={draft.intervalWindow ? "window" : "any"}
          onChange={(v) => patch({ intervalWindow: v === "window" })}
          options={[
            { value: "any", label: "Any time" },
            { value: "window", label: "Only between" },
          ]}
        />
      </Row>
      {draft.intervalWindow && (
        <Row label="Between">
          <span className="flex items-center gap-2">
            <input
              type="time"
              aria-label="From"
              value={draft.intervalFrom}
              onChange={(e) => patch({ intervalFrom: e.target.value })}
              className={TIME_INPUT_CLASS}
            />
            <span className="text-[13px] text-[var(--text-muted)]">and</span>
            <input
              type="time"
              aria-label="Until"
              value={draft.intervalUntil}
              onChange={(e) => patch({ intervalUntil: e.target.value })}
              className={TIME_INPUT_CLASS}
            />
          </span>
        </Row>
      )}
      <Row label="Days">
        <RowSelect
          value={someDays ? "some" : "all"}
          onChange={(v) => patch({ intervalDays: v === "some" ? WORKDAYS : [] })}
          options={[
            { value: "all", label: "Every day" },
            { value: "some", label: "Certain days" },
          ]}
        />
      </Row>
      {someDays && (
        <Row label="On" alignTop>
          <WeekdayPicker
            value={draft.intervalDays}
            onChange={(intervalDays) => patch({ intervalDays })}
          />
        </Row>
      )}
    </>
  );
}
