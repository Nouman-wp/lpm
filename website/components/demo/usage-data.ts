export type UsageToolKey = "claude" | "codex";

export type UsageWindowChoice = "fiveHour" | "weekly" | "higher";

export type UsageSidebarSettings = {
  enabled: boolean;
  tools: UsageToolKey[];
  window: UsageWindowChoice;
};

export type UsageWindowData = {
  usedPercent: number;
  /** Share of the window already gone — the tick mark on the meter. */
  elapsedPercent: number;
  /** How far off the reset is, held as an offset rather than a date so the
   *  card reads as today's whenever the page is opened. */
  resetInMs: number;
};

export type UsageProviderData = {
  key: UsageToolKey;
  label: string;
  color: string;
  plan: string;
  account?: string;
  updated: string;
  tokensToday: string;
  sessions: number;
  fiveHour: UsageWindowData;
  weekly: UsageWindowData;
};

export const DEFAULT_USAGE_SETTINGS: UsageSidebarSettings = {
  enabled: true,
  tools: ["claude", "codex"],
  window: "weekly",
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long until a window rolls over, in the app's shape: "2h 14m", "6d 23h",
 *  "18m". */
export function resetDurationShort(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** The wall-clock moment a window rolls over, in the visitor's own locale. */
export function resetAbsolute(ms: number): string {
  return new Date(Date.now() + ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const USAGE_PROVIDERS: UsageProviderData[] = [
  {
    key: "claude",
    label: "Claude",
    color: "#D97757",
    plan: "Fable 5",
    account: "you@example.com",
    updated: "updated 2m ago",
    tokensToday: "14.2M",
    sessions: 9,
    fiveHour: {
      usedPercent: 41,
      elapsedPercent: 55,
      resetInMs: 2 * HOUR + 14 * MINUTE,
    },
    weekly: {
      usedPercent: 65,
      elapsedPercent: 89,
      resetInMs: 18 * HOUR + 29 * MINUTE,
    },
  },
  {
    key: "codex",
    label: "Codex",
    color: "#10A37F",
    plan: "Pro",
    updated: "updated 6m ago",
    tokensToday: "8.4M",
    sessions: 4,
    fiveHour: {
      usedPercent: 12,
      elapsedPercent: 8,
      resetInMs: 4 * HOUR + 36 * MINUTE,
    },
    weekly: {
      usedPercent: 27,
      elapsedPercent: 21,
      resetInMs: 5 * DAY + 13 * HOUR,
    },
  },
];

export const TOKENS_TODAY = "22.6M";

/** What a weekly window has left, which is how Codex's own status line puts it.
 *  Derived so the meter and the transcript can never quote different weeks. */
export function weeklyLeftPercent(key: UsageToolKey): number {
  const provider = USAGE_PROVIDERS.find((p) => p.key === key);
  return provider ? Math.round(100 - provider.weekly.usedPercent) : 100;
}

export function usageBarColor(usedPercent: number): string {
  if (usedPercent >= 95) return "#f87171";
  if (usedPercent >= 80) return "#fbbf24";
  return "#22d3ee";
}

type PickedWindow = {
  win: UsageWindowData;
  label: string;
  /** "5h" beside the reset; the weekly window goes unlabelled. */
  short: string;
};

/** The window a sidebar row's numbers are about, and the other one for the
 *  thin lane under its bar. */
export function pickUsageWindow(
  provider: UsageProviderData,
  choice: UsageWindowChoice,
): PickedWindow & { other: PickedWindow } {
  const five = { win: provider.fiveHour, label: "5-hour", short: "5h" };
  const week = { win: provider.weekly, label: "weekly", short: "" };
  const lead = (main: PickedWindow, other: PickedWindow) => ({ ...main, other });
  if (choice === "fiveHour") return lead(five, week);
  if (choice === "higher" && five.win.usedPercent >= week.win.usedPercent) {
    return lead(five, week);
  }
  return lead(week, five);
}

export const USAGE_FILL = "#22d3ee";
const AHEAD_FILL = "#f87171";

/** A usage bar's background: `fill`, turning red from the pace tick on — the
 *  use that came faster than even pace. Both arguments are percents of the
 *  whole bar. */
export function paceFill(width: number, pace: number, fill = USAGE_FILL): string {
  if (width <= 0 || pace >= width) return fill;
  const at = ((pace / width) * 100).toFixed(2);
  return `linear-gradient(to right, ${fill} 0 ${at}%, ${AHEAD_FILL} ${at}%)`;
}

// A raw "65% used" says nothing until it is read against how much of the window
// has burned down, so every meter is judged against elapsed wall-clock time.
export function usagePaceLabel(win: UsageWindowData): string {
  if (win.usedPercent >= 100) return "limit reached";
  if (win.elapsedPercent < 5) return "";
  const ratio = win.usedPercent / win.elapsedPercent;
  if (ratio > 1.15) return "ahead of pace";
  if (ratio < 0.85) return "under pace";
  return "on pace";
}

export function usagePaceColor(label: string): string {
  if (label === "limit reached") return "text-[#f87171]";
  if (label === "ahead of pace") return "text-[#fbbf24]";
  return "text-[#919191]";
}

export type SidebarUsageRow = {
  key: UsageToolKey;
  label: string;
  color: string;
  detail: string;
  percentText: string;
  fraction: number;
  /** How far through its window the clock is (0–1), where the pace tick sits. */
  pace: number;
  windowLabel: string;
  windowShort: string;
  /** The other window's share used, drawn as the hairline lane under the bar. */
  laneFraction: number;
  laneText: string;
};

function usedFraction(win: UsageWindowData): number {
  return Math.max(0, Math.min(100, win.usedPercent)) / 100;
}

/** One row per tool, in a fixed order so rows never swap under the pointer. */
export function sidebarUsageRows(settings: UsageSidebarSettings): SidebarUsageRow[] {
  if (!settings.enabled) return [];
  return USAGE_PROVIDERS.filter((provider) => settings.tools.includes(provider.key)).map(
    (provider) => {
      const { win, label, short, other } = pickUsageWindow(provider, settings.window);
      return {
        key: provider.key,
        label: provider.label,
        color: provider.color,
        detail: resetDurationShort(win.resetInMs),
        percentText: `${Math.round(win.usedPercent)}%`,
        fraction: usedFraction(win),
        pace: Math.max(0, Math.min(100, win.elapsedPercent)) / 100,
        windowLabel: label,
        windowShort: short,
        laneFraction: usedFraction(other.win),
        laneText: `${other.label} ${Math.round(other.win.usedPercent)}% used`,
      };
    },
  );
}
