// Five-field cron lines (minute hour day-of-month month day-of-week) as the
// scheduler reads them (jobcron.rs): lists, ranges, steps, month and weekday
// names, the @daily-style shorthands, local time, and the Vixie rule that a day
// matches either restricted day field. The editor validates and previews with
// this, so its messages match what saving would hear back.

export type CronField = "minute" | "hour" | "dom" | "month" | "dow";

export const CRON_FIELDS: CronField[] = ["minute", "hour", "dom", "month", "dow"];

export const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface FieldInfo {
  label: string;
  min: number;
  max: number;
  names?: string[];
  namesFrom?: number;
}

export const CRON_FIELD_INFO: Record<CronField, FieldInfo> = {
  minute: { label: "minute", min: 0, max: 59 },
  hour: { label: "hour", min: 0, max: 23 },
  dom: { label: "day of month", min: 1, max: 31 },
  month: { label: "month", min: 1, max: 12, names: MONTH_NAMES, namesFrom: 1 },
  // 7 is Sunday too; it's folded onto 0 once parsed.
  dow: { label: "day of week", min: 0, max: 7, names: DAY_NAMES, namesFrom: 0 },
};

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const MIN_GAP_SECS = 300;
// Far enough to reach the next 29 February from any date, 2100 included.
const SEARCH_DAYS = 366 * 8 + 2;

export interface CronSpec {
  // The line as written, whitespace collapsed.
  source: string;
  // The five field texts, a shorthand expanded.
  tokens: string[];
  sets: Record<CronField, Set<number>>;
  domAny: boolean;
  dowAny: boolean;
}

export type CronParse =
  | { ok: true; spec: CronSpec }
  | { ok: false; error: string; field?: CronField };

class FieldError extends Error {}

export function normalizeCron(expr: string): string {
  return expr.trim().split(/\s+/).filter(Boolean).join(" ");
}

// The five field texts of a line, a shorthand expanded; null when it isn't
// five fields.
export function cronTokens(expr: string): string[] | null {
  const source = normalizeCron(expr);
  const line = MACROS[source.toLowerCase()] ?? source;
  const parts = line.split(" ");
  return parts.length === 5 ? parts : null;
}

export function cronValue(text: string, field: CronField): number {
  const f = CRON_FIELD_INFO[field];
  let n: number;
  if (/^\d+$/.test(text)) {
    n = Number(text);
  } else {
    const i = f.names?.indexOf(text.toLowerCase()) ?? -1;
    if (i < 0) throw new FieldError(`“${text}” isn't a valid ${f.label}.`);
    n = i + (f.namesFrom ?? 0);
  }
  if (n < f.min || n > f.max) {
    throw new FieldError(`The ${f.label} field takes ${f.min}–${f.max}, not ${n}.`);
  }
  return n;
}

function fieldSet(text: string, field: CronField): Set<number> {
  const f = CRON_FIELD_INFO[field];
  const out = new Set<number>();
  for (const item of text.split(",")) {
    const slash = item.indexOf("/");
    const range = slash < 0 ? item : item.slice(0, slash);
    let step: number | undefined;
    if (slash >= 0) {
      const s = item.slice(slash + 1);
      step = /^\d+$/.test(s) ? Number(s) : 0;
      if (step <= 0) throw new FieldError(`“${item}” needs a whole step above 0 in the ${f.label} field.`);
    }
    let lo: number;
    let hi: number;
    if (range === "*") {
      [lo, hi] = [f.min, f.max];
    } else if (range.includes("-")) {
      const dash = range.indexOf("-");
      [lo, hi] = [cronValue(range.slice(0, dash), field), cronValue(range.slice(dash + 1), field)];
    } else {
      lo = cronValue(range, field);
      hi = step !== undefined ? f.max : lo;
    }
    if (lo > hi) throw new FieldError(`“${range}” runs backwards in the ${f.label} field.`);
    for (let v = lo; v <= hi; v += step ?? 1) out.add(v);
  }
  if (field === "dow" && out.has(7)) {
    out.delete(7);
    out.add(0);
  }
  return out;
}

const LONGEST = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function hasADay(spec: CronSpec): boolean {
  if (!spec.dowAny) return true;
  return [...spec.sets.month].some((m) =>
    [...spec.sets.dom].some((d) => d <= LONGEST[m - 1]),
  );
}

function minGapMinutes(spec: CronSpec): number {
  const minutes = [...spec.sets.minute].sort((a, b) => a - b);
  let gap = Infinity;
  for (let i = 1; i < minutes.length; i++) gap = Math.min(gap, minutes[i] - minutes[i - 1]);
  const hours = spec.sets.hour;
  const backToBack = [...hours].some((h) => hours.has((h + 1) % 24));
  if (backToBack && minutes.length > 0) {
    gap = Math.min(gap, 60 - minutes[minutes.length - 1] + minutes[0]);
  }
  return gap;
}

export function parseCron(expr: string): CronParse {
  const source = normalizeCron(expr);
  if (!source) return { ok: false, error: "Enter a cron line." };
  if (source.startsWith("@") && !MACROS[source.toLowerCase()]) {
    return { ok: false, error: `“${source}” isn't a schedule lpm knows.` };
  }
  const tokens = cronTokens(source);
  if (!tokens) {
    return {
      ok: false,
      error: "A cron line has five fields: minute, hour, day of month, month and day of week.",
    };
  }
  const sets = {} as Record<CronField, Set<number>>;
  for (const [i, field] of CRON_FIELDS.entries()) {
    try {
      sets[field] = fieldSet(tokens[i], field);
    } catch (err) {
      if (err instanceof FieldError) return { ok: false, error: err.message, field };
      throw err;
    }
  }
  const spec: CronSpec = {
    source,
    tokens,
    sets,
    domAny: tokens[2].startsWith("*"),
    dowAny: tokens[4].startsWith("*"),
  };
  if (!hasADay(spec)) {
    return { ok: false, error: "That cron line never runs — no month has that date.", field: "dom" };
  }
  if (minGapMinutes(spec) * 60 < MIN_GAP_SECS) {
    return {
      ok: false,
      error: `An automation can run at most every ${MIN_GAP_SECS / 60} minutes.`,
      field: "minute",
    };
  }
  return { ok: true, spec };
}

export function cronDayMatches(spec: CronSpec, day: Date): boolean {
  if (!spec.sets.month.has(day.getMonth() + 1)) return false;
  const dom = spec.sets.dom.has(day.getDate());
  const dow = spec.sets.dow.has(day.getDay());
  return spec.domAny || spec.dowAny ? dom && dow : dom || dow;
}

// A day's runs as epoch seconds. A time the clock skips at a DST change runs
// when the clock reaches it, like the scheduler does.
function dayRuns(spec: CronSpec, day: Date): number[] {
  const hours = [...spec.sets.hour].sort((a, b) => a - b);
  const minutes = [...spec.sets.minute].sort((a, b) => a - b);
  const out: number[] = [];
  for (const h of hours) {
    for (const m of minutes) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime() / 1000;
      if (out[out.length - 1] !== at) out.push(at);
    }
  }
  return out;
}

function addDays(day: Date, n: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);
}

// Every run inside [from, to], oldest first, stopping at `limit`.
export function cronRunsBetween(spec: CronSpec, from: number, to: number, limit: number): number[] {
  const out: number[] = [];
  const start = new Date(from * 1000);
  for (let day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day.getTime() / 1000 <= to; day = addDays(day, 1)) {
    if (!cronDayMatches(spec, day)) continue;
    for (const at of dayRuns(spec, day)) {
      if (at < from || at > to) continue;
      out.push(at);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// The next `count` runs strictly after `after`.
export function nextCronRuns(spec: CronSpec, after: number, count: number): number[] {
  const out: number[] = [];
  const start = new Date(after * 1000);
  let day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; i < SEARCH_DAYS && out.length < count; i++, day = addDays(day, 1)) {
    if (!cronDayMatches(spec, day)) continue;
    for (const at of dayRuns(spec, day)) {
      if (at > after) out.push(at);
      if (out.length >= count) break;
    }
  }
  return out;
}

// The line with one field's text replaced; a line that isn't five fields yet
// is filled out with `*` first.
export function withCronField(expr: string, field: CronField, text: string): string {
  const tokens = cronTokens(expr) ?? padTokens(normalizeCron(expr));
  tokens[CRON_FIELDS.indexOf(field)] = text;
  return tokens.join(" ");
}

function padTokens(source: string): string[] {
  const parts = source ? source.split(" ").slice(0, 5) : [];
  while (parts.length < 5) parts.push("*");
  return parts;
}

// Which field the caret sits in: the whitespace-separated token it touches.
export function cronFieldAt(expr: string, caret: number): CronField | null {
  if (normalizeCron(expr).startsWith("@")) return null;
  const before = expr.slice(0, caret);
  const index = before.trimStart().split(/\s+/).length - 1;
  return CRON_FIELDS[Math.min(index, 4)] ?? null;
}

// Where a field's text sits in the line as typed, to select it; null for a
// shorthand or a line that doesn't reach that field yet.
export function cronTokenRange(expr: string, field: CronField): [number, number] | null {
  if (normalizeCron(expr).startsWith("@")) return null;
  const match = [...expr.matchAll(/\S+/g)][CRON_FIELDS.indexOf(field)];
  return match?.index === undefined ? null : [match.index, match.index + match[0].length];
}
