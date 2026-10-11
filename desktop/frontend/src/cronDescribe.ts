// A cron line in plain words — "At 18:00 on Fridays" — as segments tagged with
// the field each part came from, so the editor can light up the words a field
// controls. Also the per-field cheat sheet and the run-rate line.

import {
  CRON_FIELD_INFO,
  cronRunsBetween,
  cronValue,
  parseCron,
  type CronField,
  type CronSpec,
} from "./cronExpr";

export interface CronSegment {
  text: string;
  field?: CronField;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Item =
  | { kind: "all" }
  | { kind: "value"; v: number }
  | { kind: "range"; a: number; b: number }
  | { kind: "step"; from?: number; to?: number; n: number };

function itemsOf(token: string, field: CronField): Item[] {
  return token.split(",").map((item): Item => {
    const [range, step] = item.split("/");
    if (step !== undefined) {
      if (range === "*") return { kind: "step", n: Number(step) };
      const dash = range.indexOf("-");
      return dash < 0
        ? { kind: "step", from: cronValue(range, field), n: Number(step) }
        : {
            kind: "step",
            from: cronValue(range.slice(0, dash), field),
            to: cronValue(range.slice(dash + 1), field),
            n: Number(step),
          };
    }
    if (range === "*") return { kind: "all" };
    const dash = range.indexOf("-");
    if (dash < 0) return { kind: "value", v: cronValue(range, field) };
    return { kind: "range", a: cronValue(range.slice(0, dash), field), b: cronValue(range.slice(dash + 1), field) };
  });
}

function values(items: Item[]): number[] | null {
  return items.every((i) => i.kind === "value")
    ? items.map((i) => (i as { v: number }).v)
    : null;
}

export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// "every 15 minutes", "minute 5", "every hour from 9 through 17", "hours 9 and 17".
function unitPhrase(token: string, field: "minute" | "hour"): string {
  const unit = field;
  const items = itemsOf(token, field);
  const vals = values(items);
  if (vals && vals.length > 1) return `${unit}s ${listPhrase(vals.map(String))}`;
  if (items.length > 1) return `${unit}s ${token}`;
  const item = items[0];
  switch (item.kind) {
    case "all":
      return `every ${unit}`;
    case "value":
      return `${unit} ${item.v}`;
    case "range":
      return `every ${unit} from ${item.a} through ${item.b}`;
    case "step": {
      const every = `every ${item.n} ${unit}s`;
      if (item.from === undefined) return every;
      return `${every} from ${item.from} through ${item.to ?? CRON_FIELD_INFO[field].max}`;
    }
  }
}

function timeSegments(spec: CronSpec): CronSegment[] {
  const [minuteToken, hourToken] = spec.tokens;
  const minutes = itemsOf(minuteToken, "minute");
  const hours = itemsOf(hourToken, "hour");
  const minuteValues = values(minutes);
  const hourValues = values(hours);

  // "At 09:30 and 17:30" — a fixed minute on a few named hours reads as times.
  if (minuteValues?.length === 1 && hourValues && hourValues.length <= 6) {
    const mm = pad2(minuteValues[0]);
    const out: CronSegment[] = [{ text: "At " }];
    hourValues.forEach((h, i) => {
      if (i > 0) out.push({ text: i === hourValues.length - 1 ? " and " : ", " });
      out.push({ text: pad2(h), field: "hour" }, { text: ":" }, { text: mm, field: "minute" });
    });
    return out;
  }

  // "Every 15 minutes from 09:00 through 17:59" — a repeating minute inside a
  // stretch of hours reads as a window.
  const repeating = minutes.length === 1 && (minutes[0].kind === "all" || (minutes[0].kind === "step" && minutes[0].from === undefined));
  const hour = hours.length === 1 ? hours[0] : null;
  if (repeating && hour && (hour.kind === "value" || hour.kind === "range")) {
    const [a, b] = hour.kind === "value" ? [hour.v, hour.v] : [hour.a, hour.b];
    return [
      { text: capitalize(unitPhrase(minuteToken, "minute")), field: "minute" },
      { text: " from " },
      { text: `${pad2(a)}:00 through ${pad2(b)}:59`, field: "hour" },
    ];
  }

  if (hours.length === 1 && hours[0].kind === "all") {
    if (minuteValues?.length === 1) {
      return [
        { text: "At " },
        { text: `minute ${minuteValues[0]}`, field: "minute" },
        { text: " past " },
        { text: "every hour", field: "hour" },
      ];
    }
    return [{ text: capitalize(unitPhrase(minuteToken, "minute")), field: "minute" }];
  }

  const minutePart: CronSegment[] =
    minuteValues?.length === 1
      ? [{ text: "At " }, { text: `minute ${minuteValues[0]}`, field: "minute" }]
      : [{ text: capitalize(unitPhrase(minuteToken, "minute")), field: "minute" }];
  return [...minutePart, { text: " past " }, { text: unitPhrase(hourToken, "hour"), field: "hour" }];
}

function domPhrase(token: string): string {
  const items = itemsOf(token, "dom");
  const vals = values(items);
  if (vals) return `on the ${listPhrase(vals.map(ordinal))}`;
  if (items.length === 1) {
    const item = items[0];
    if (item.kind === "range") return `on the ${ordinal(item.a)} through the ${ordinal(item.b)}`;
    if (item.kind === "step" && item.from === undefined) return `on every ${ordinal(item.n)} day of the month`;
  }
  return `on days ${token} of the month`;
}

function dowPhrase(token: string, set: Set<number>): string {
  const is = (days: number[]) => set.size === days.length && days.every((d) => set.has(d));
  if (is([1, 2, 3, 4, 5])) return "on weekdays";
  if (is([0, 6])) return "on weekends";
  const items = itemsOf(token, "dow");
  const vals = values(items);
  if (vals) return `on ${listPhrase(vals.map((d) => `${DAYS[d % 7]}s`))}`;
  if (items.length === 1 && items[0].kind === "range") {
    return `on ${DAYS[items[0].a % 7]} through ${DAYS[items[0].b % 7]}`;
  }
  return `on ${listPhrase([...set].sort((a, b) => a - b).map((d) => `${DAYS[d]}s`))}`;
}

function monthPhrase(token: string): string {
  const items = itemsOf(token, "month");
  const vals = values(items);
  if (vals) return `in ${listPhrase(vals.map((m) => MONTHS[m - 1]))}`;
  if (items.length === 1) {
    const item = items[0];
    if (item.kind === "range") return `from ${MONTHS[item.a - 1]} through ${MONTHS[item.b - 1]}`;
    if (item.kind === "step" && item.from === undefined) return `every ${item.n} months`;
  }
  return `in months ${token}`;
}

export function describeCron(spec: CronSpec): CronSegment[] {
  const [, , dom, month, dow] = spec.tokens;
  const out = timeSegments(spec);
  const hasDom = dom !== "*";
  const hasDow = dow !== "*";
  if (hasDom) out.push({ text: " " }, { text: domPhrase(dom), field: "dom" });
  if (hasDow) {
    // Both day fields restricted means either is enough (the Vixie rule).
    const either = hasDom && !spec.domAny && !spec.dowAny;
    out.push({ text: either ? " or " : hasDom ? " and " : " " });
    out.push({ text: dowPhrase(dow, spec.sets.dow), field: "dow" });
  }
  if (month !== "*") out.push({ text: " " }, { text: monthPhrase(month), field: "month" });
  return out;
}

export function describeCronText(expr: string): string | null {
  const parsed = parseCron(expr);
  return parsed.ok ? describeCron(parsed.spec).map((s) => s.text).join("") : null;
}

export interface CronFieldGuide {
  title: string;
  range: string;
  examples: { token: string; meaning: string }[];
}

export const CRON_FIELD_GUIDE: Record<CronField, CronFieldGuide> = {
  minute: {
    title: "Minute",
    range: "0–59",
    examples: [
      { token: "0", meaning: "on the hour" },
      { token: "30", meaning: "half past" },
      { token: "0,30", meaning: "on the hour and half past" },
      { token: "*/15", meaning: "every 15 minutes" },
    ],
  },
  hour: {
    title: "Hour",
    range: "0–23",
    examples: [
      { token: "*", meaning: "every hour" },
      { token: "9,17", meaning: "09:00 and 17:00" },
      { token: "9-17", meaning: "09:00 through 17:59" },
      { token: "*/2", meaning: "every 2 hours" },
    ],
  },
  dom: {
    title: "Day of month",
    range: "1–31",
    examples: [
      { token: "*", meaning: "every day" },
      { token: "1", meaning: "the 1st" },
      { token: "1,15", meaning: "the 1st and 15th" },
      { token: "1-7", meaning: "the first seven days" },
    ],
  },
  month: {
    title: "Month",
    range: "1–12 or jan–dec",
    examples: [
      { token: "*", meaning: "every month" },
      { token: "1", meaning: "January" },
      { token: "1,7", meaning: "January and July" },
      { token: "*/3", meaning: "every 3 months" },
    ],
  },
  dow: {
    title: "Day of week",
    range: "0–6 or sun–sat",
    examples: [
      { token: "*", meaning: "any day" },
      { token: "1-5", meaning: "weekdays" },
      { token: "0,6", meaning: "weekends" },
      { token: "5", meaning: "Fridays" },
    ],
  },
};

const DAY_SECS = 86400;
const runs = (n: number, per: string) => `${n} run${n === 1 ? "" : "s"} a ${per}`;

// "1 run a week", "24 runs a day", "12 runs a year" — how busy the line is.
export function cronFrequency(spec: CronSpec, now: number): string {
  const week = cronRunsBetween(spec, now, now + 7 * DAY_SECS, 5000).length;
  if (week >= 14) return runs(Math.round(week / 7), "day");
  if (week >= 1) return runs(week, "week");
  const year = cronRunsBetween(spec, now, now + 366 * DAY_SECS, 400).length;
  if (year >= 24) return runs(Math.round(year / 12), "month");
  return year >= 1 ? runs(year, "year") : "";
}

// "in 12 minutes", "in 3 hours", "tomorrow", "in 5 days".
export function cronRelative(at: number, now: number): string {
  const secs = Math.max(0, at - now);
  if (secs < 3600) {
    const m = Math.max(1, Math.round(secs / 60));
    return `in ${m} minute${m === 1 ? "" : "s"}`;
  }
  if (secs < DAY_SECS) {
    const h = Math.floor(secs / 3600);
    return `in ${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.floor(secs / DAY_SECS);
  return d === 1 ? "tomorrow" : `in ${d} days`;
}
