// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobFrequencyCard } from "./JobFrequencyCard";
import { defaultJobDraft, describeDraftSchedule, type JobDraft } from "../../../jobsFormat";
import { validateDraftSchedule } from "../../../jobsScheduleDraft";

const transformText = vi.fn();
vi.mock("../../../../bridge/commands", () => ({
  TransformText: (...args: unknown[]) => transformText(...args),
  CancelAIGenerate: () => Promise.resolve(),
  SaveSettings: () => Promise.resolve(),
  LoadSettings: () => Promise.resolve({}),
  CheckAICLIs: () =>
    Promise.resolve({ claude: true, codex: false, gemini: false, opencode: false }),
}));

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
      ai={{ project: "app", cwd: "/work/app" }}
    />
  );
}

const button = (label: string) => {
  const found = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!found) throw new Error(`no button "${label}"`);
  return found;
};

const click = (label: string) => act(() => button(label).click());

const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(() => {
    const proto = Object.getPrototypeOf(el) as HTMLInputElement | HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

const cronInput = () => host.querySelector<HTMLInputElement>('input[aria-label="Cron line"]')!;


beforeEach(() => {
  transformText.mockReset();
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
    expect(host.textContent).not.toContain("As cron");
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

describe("JobFrequencyCard as cron", () => {
  it("starts the line from the form and reads it back as a sentence", () => {
    click("Weekly");
    click("Cron");
    expect(latest.scheduleKind).toBe("cron");
    expect(latest.cron).toBe("0 9 * * 1");
    expect(host.textContent).toContain("“At 09:00 on Mondays.”");
    expect(host.textContent).not.toContain("Repeat");
    // The fields, their guide and the next runs stay folded until asked for.
    expect(host.textContent).not.toContain("click a field");
    expect(host.textContent).not.toContain("1 run a week");
    expect(host.textContent).not.toContain("Runs on local time");
    click("Field guide and next runs");
    expect(host.textContent).toContain("click a field");
    expect(host.textContent).toContain("1 run a week");
    expect(host.textContent).toContain("Runs on local time");
  });

  it("carries a line the form can say across, and keeps it as typed", () => {
    click("Cron");
    type(cronInput(), "0 18 * * fri");
    expect(host.textContent).toContain("“At 18:00 on Fridays.”");
    click("Simple");
    expect(latest.scheduleKind).toBe("form");
    expect(latest.days).toEqual(["fri"]);
    expect(latest.time).toBe("18:00");
    expect(host.textContent).toContain("Fridays at 18:00.");
    click("Cron");
    expect(latest.cron).toBe("0 18 * * fri");
    click("Simple");
    click("Daily");
    click("Cron");
    expect(latest.cron).toBe("0 18 * * *");
  });

  it("keeps a line the form can't say when it's only been looked at", () => {
    click("Cron");
    type(cronInput(), "*/15 9-17 * * 1-5");
    click("Simple");
    expect(host.textContent).toContain("Every day at 09:00.");
    click("Cron");
    expect(latest.cron).toBe("*/15 9-17 * * 1-5");
  });

  it("shows what a field takes and drops an example into it", () => {
    click("Cron");
    click("Field guide and next runs");
    act(() => button("*day of week").click());
    expect(host.textContent).toContain("Day of week0–6 or sun–sat");
    click("1-5weekdays");
    expect(latest.cron).toBe("0 9 * * 1-5");
    type(cronInput(), "0 25 * * *");
    expect(host.textContent).toContain("The hour field takes 0–23, not 25.");
    expect(host.textContent).toContain("Waiting for a valid cron line");
  });

  it("keeps a broken line's problem in view while the details are folded", () => {
    click("Cron");
    type(cronInput(), "0 25 * * *");
    expect(host.textContent).toContain("The hour field takes 0–23, not 25.");
    expect(host.textContent).not.toContain("Waiting for a valid cron line");
  });

  it("has the default agent write the line from a description, with an undo", async () => {
    transformText.mockResolvedValue("```\n30 9 * * 1-5\n```");
    await act(async () => root.render(<Harness key="ai" />));
    click("Cron");
    await act(async () => {});
    const box = host.querySelector("textarea")!;
    type(box, "weekdays at half nine");
    const convert = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Convert to cron"),
    )!;
    await act(async () => convert.click());

    expect(transformText.mock.calls[0].slice(0, 2)).toEqual(["app", "/work/app"]);
    expect(transformText.mock.calls[0][7]).toBe("weekdays at half nine");
    expect(latest.cron).toBe("30 9 * * 1-5");
    expect(host.textContent).toContain("Set the cron line to 30 9 * * 1-5");
    click("Undo");
    expect(latest.cron).toBe("0 9 * * *");
  });

  it("converts with the model picked next to the button", async () => {
    transformText.mockResolvedValue("0 18 * * 5");
    await act(async () => root.render(<Harness key="model" />));
    click("Cron");
    await act(async () => {});
    type(host.querySelector("textarea")!, "fridays at six pm");
    act(() => host.querySelector<HTMLButtonElement>('button[title="Select AI CLI and model"]')!.click());
    act(() => button("Haiku").click());
    expect(host.textContent).toContain("Claude Code Haiku turns this into a cron line");
    const convert = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Convert to cron"),
    )!;
    await act(async () => convert.click());
    expect(transformText.mock.calls[0].slice(2, 4)).toEqual(["claude", "haiku"]);
    expect(latest.cron).toBe("0 18 * * 5");
  });
});
