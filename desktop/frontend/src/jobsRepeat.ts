// The editor's "Repeat" vocabulary, derived from (and written back to) the
// draft's schedule fields.

import type { JobDraft } from "./jobsFormat";
import { isoDate } from "./jobsScheduleRules";

export type Repeat = "daily" | "weekly" | "monthly" | "interval" | "once" | "manual";

export const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "interval", label: "Interval" },
  { value: "once", label: "Once" },
  { value: "manual", label: "Manual" },
];

export function repeatOf(draft: JobDraft): Repeat {
  if (draft.scheduleMode === "manual") return "manual";
  if (draft.scheduleMode === "interval") return "interval";
  if (draft.dayRule === "dates" || draft.dayRule === "nth") return "monthly";
  if (draft.dayRule === "once") return "once";
  return draft.days.length > 0 ? "weekly" : "daily";
}

export function repeatPatch(
  draft: JobDraft,
  next: Repeat,
  now: Date = new Date(),
): Partial<JobDraft> {
  switch (next) {
    case "manual":
    case "interval":
      return { scheduleMode: next };
    case "daily":
      return { scheduleMode: "time", dayRule: "week", days: [] };
    case "weekly":
      return {
        scheduleMode: "time",
        dayRule: "week",
        days: draft.days.length > 0 ? draft.days : ["mon"],
      };
    case "monthly":
      return { scheduleMode: "time", dayRule: draft.dayRule === "nth" ? "nth" : "dates" };
    case "once": {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      return {
        scheduleMode: "time",
        dayRule: "once",
        onceDate: draft.onceDate || isoDate(tomorrow),
      };
    }
  }
}
