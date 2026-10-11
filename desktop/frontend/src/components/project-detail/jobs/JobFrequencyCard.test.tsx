// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JobFrequencyCard } from "./JobFrequencyCard";
import { defaultJobDraft, describeDraftSchedule, type JobDraft } from "../../../jobsFormat";
import { validateDraftSchedule } from "../../../jobsScheduleDraft";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let latest: JobDraft;

function Harness({ initial = defaultJobDraft() }: { initial?: JobDraft }) {
  const [draft, setDraft] = useState<JobDraft>(initial);
  latest = draft;
  return (
    <JobFrequencyCard
      draft={draft}
      patch={(values) => setDraft((d) => ({ ...d, ...values }))}
      summary={describeDraftSchedule(draft)}
      problem={validateDraftSchedule(draft)}
    />
  );
}

const button = (label: string) => {
  const found = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!found) throw new Error(`no button "${label}"`);
  return found;
};

const click = (label: string) => act(() => button(label).click());


beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("JobFrequencyCard", () => {
  it("builds a monthly schedule from the date grid", () => {
    click("Monthly");
    click("1");
    click("15");
    click("Last day");
    expect(latest.dayRule).toBe("dates");
    expect(latest.monthDates).toEqual([15]);
    expect(latest.lastDay).toBe(true);
    expect(host.textContent).toContain("On the 15th and last day of every month at 09:00");
    expect(host.textContent).toContain("Cron has no “last day of the month”");
    click("Last day");
    expect(host.textContent).toContain("As cron0 9 15 * *");
  });

  it("adds a second time of day", () => {
    click("Add time");
    expect(latest.moreTimes).toEqual(["13:00"]);
    expect(host.textContent).toContain("Every day at 09:00 and 13:00");
  });

  it("switches to a position in the month, a one-off date and an interval", () => {
    click("Monthly");
    click("Day of week");
    expect(host.textContent).toContain("On the first Monday of every month at 09:00");
    click("Once");
    expect(latest.dayRule).toBe("once");
    expect(latest.onceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(host.textContent).toContain("Once, on");
    click("Interval");
    expect(host.textContent).toContain("Hours");
    click("Manual");
    expect(host.textContent).toContain("Runs only when you start it");
  });

  it("shows the rows with a recap, and the problem in its place", () => {
    expect(host.textContent).toContain("Repeat");
    expect(host.textContent).toContain("Every day at 09:00.");
    const past: JobDraft = { ...defaultJobDraft(), dayRule: "once", onceDate: "2000-01-01" };
    act(() => root.render(<Harness key="past" initial={past} />));
    expect(host.textContent).toContain("That date has already passed.");
    expect(host.textContent).not.toContain("Once, on");
  });
});
