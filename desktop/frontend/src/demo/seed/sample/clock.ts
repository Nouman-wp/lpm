// Seeded logs are stamped when the demo loads rather than written down, so a
// service's output never reads as months old.
const SEED_DAY = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const Y = SEED_DAY.getFullYear();
const M = pad(SEED_DAY.getMonth() + 1);
const D = pad(SEED_DAY.getDate());
const MONTH_ABBR = SEED_DAY.toLocaleString("en-US", { month: "short" });

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

/** 20260904 — the date half of a Rails migration version or a run id. */
export const YMD = `${Y}${M}${D}`;
/** 2026/09/04 — Go's default log date. */
export const SLASHED = `${Y}/${M}/${D}`;
/** 2026-09-04 — ISO, as Jupyter prints it. */
export const DASHED = `${Y}-${M}-${D}`;
/** 4 Sep 2026 — how redis stamps its startup lines. */
export const REDIS_DAY = `${SEED_DAY.getDate()} ${MONTH_ABBR} ${Y}`;
/** v2026.9.4 — a calendar-versioned release tag. */
export const CALVER = `v${Y}.${SEED_DAY.getMonth() + 1}.${SEED_DAY.getDate()}`;
/** sep-04 — the date a nightly job's branch name carries. */
export const SEED_BRANCH_DAY = `${MONTH_ABBR.toLowerCase()}-${D}`;

// Boot banners are stamped a few seconds before the demo loaded, so a service
// the visitor starts reports a boot that just happened.
const clockAgo = (seconds: number) => {
  const t = new Date(SEED_DAY.getTime() - seconds * SECOND);
  return `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
};
// tsc stamps its watch lines with toLocaleTimeString, so they come out 12-hour.
const clock12Ago = (seconds: number) =>
  new Date(SEED_DAY.getTime() - seconds * SECOND).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

export const BOOT_T0 = clockAgo(3);
export const BOOT_T1 = clockAgo(2);
export const BOOT_T2 = clockAgo(1);
export const WATCH_T0 = clock12Ago(3);
export const WATCH_T1 = clock12Ago(1);

export const runId = (clock: string) => `${YMD}-${clock.replace(/:/g, "")}`;
