import { addDays, localDate, rangeLabel, weekStart } from "../stats/statsDates";

export interface RecapDay {
  date: string;
  agentMs: number;
  prompts: number;
}

/** Agent time on one project, or by one agent. */
export interface RecapTime {
  name: string;
  agentMs: number;
}

/** One week of agent work on this computer and every connected one. */
export interface WeeklyRecap {
  week: string;
  days: RecapDay[];
  previousAgentMs: number;
  sessions: number;
  projects: RecapTime[];
  agents: RecapTime[];
  repos: string[];
  linesAdded: number;
  linesRemoved: number;
  // Absent when GitHub couldn't be asked.
  pullRequests?: number;
  // Paired computers that couldn't add their week.
  missing?: string[];
}

export type RecapWeek = "last" | "this";

// Monday to Wednesday: the start of a week, while last week is still news.
export const RECAP_NEWS_DAYS = 3;

export interface MixSlice {
  label: string;
  percent: number;
  color: string;
}

export interface RecapTile {
  value: string;
  label: string;
}

export interface RecapView {
  range: string;
  hours: string;
  gain?: string;
  prompts: string;
  pullRequests?: string;
  // Prompts, then pull requests, or sessions when GitHub couldn't be asked.
  tiles: [RecapTile, RecapTile];
  linesAdded: string;
  linesRemoved: string;
  mix: MixSlice[];
  // How many projects, and the busiest one's share; never a project's name,
  // so the card can be posted as it is.
  projects?: string;
  streak: string;
  days: { letter: string; on: boolean }[];
  empty: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const AGENTS: Record<string, { label: string; color: string }> = {
  claude: { label: "Claude", color: "#de8a68" },
  codex: { label: "Codex", color: "#2dd4bf" },
};
const OTHER_COLORS = ["#c084fc", "#60a5fa", "#fbbf24"];

/** The Monday a recap of `which` week starts on. */
export function recapWeekStart(which: RecapWeek, today = localDate()): string {
  const current = weekStart(today);
  return which === "this" ? current : addDays(current, -7);
}

export function weekRangeLabel(first: string): string {
  const last = addDays(first, 6);
  const at = (date: string) => new Date(`${date}T12:00:00`);
  const format = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return typeof format.formatRange === "function"
    ? format.formatRange(at(first), at(last))
    : rangeLabel(first, last);
}

export function formatAgentTime(ms: number): string {
  const minutes = Math.round(Math.max(0, ms) / MINUTE);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatGain(ms: number): string {
  return ms >= HOUR ? `${Math.round(ms / HOUR)}h` : `${Math.round(ms / MINUTE)}m`;
}

/** Each agent's share of the agent time, Claude and Codex by name. */
export function agentMix(agents: RecapTime[]): MixSlice[] {
  const total = agents.reduce((sum, row) => sum + row.agentMs, 0);
  if (total <= 0) return [];
  let other = 0;
  return [...agents]
    .sort((a, b) => b.agentMs - a.agentMs)
    .map((row) => {
      const known = AGENTS[row.name];
      return {
        label: known?.label ?? row.name.charAt(0).toUpperCase() + row.name.slice(1),
        percent: (row.agentMs / total) * 100,
        color: known?.color ?? OTHER_COLORS[other++ % OTHER_COLORS.length],
      };
    })
    .filter((slice) => Math.round(slice.percent) > 0);
}

export function mixText(mix: MixSlice[]): string {
  return mix.map((slice) => `${slice.label} ${Math.round(slice.percent)}%`).join(" · ");
}

function longestRun(on: boolean[]): number {
  let best = 0;
  let run = 0;
  for (const day of on) {
    run = day ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function streakLabel(on: boolean[]): string {
  const run = longestRun(on);
  if (run >= 2) return `${run}-day streak`;
  const active = on.filter(Boolean).length;
  return active === 0 ? "No active days" : `${active} active day${active === 1 ? "" : "s"}`;
}

function tile(count: number, one: string, many: string): RecapTile {
  return { value: count.toLocaleString(), label: count === 1 ? one : many };
}

const narrowWeekday = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });

function projectsText(projects: RecapTime[], agentMs: number): string | undefined {
  if (projects.length === 0 || agentMs <= 0) return undefined;
  if (projects.length === 1) return "1 project";
  const share = Math.round((projects[0].agentMs / agentMs) * 100);
  return `${projects.length} projects · busiest at ${share}% of agent time`;
}

/** What the card shows. `today` cuts a week still going short: no gain on a
 *  week that isn't over. */
export function recapView(recap: WeeklyRecap, today = localDate()): RecapView {
  const agentMs = recap.days.reduce((sum, day) => sum + day.agentMs, 0);
  const prompts = recap.days.reduce((sum, day) => sum + day.prompts, 0);
  const over = addDays(recap.week, 6) < today;
  const gain = agentMs - recap.previousAgentMs;
  const on = recap.days.map((day) => day.agentMs > 0);
  return {
    range: weekRangeLabel(recap.week),
    hours: formatAgentTime(agentMs),
    gain:
      over && recap.previousAgentMs > 0 && gain >= MINUTE
        ? `↑ ${formatGain(gain)} on last week`
        : undefined,
    prompts: prompts.toLocaleString(),
    pullRequests: recap.pullRequests?.toLocaleString(),
    tiles: [
      tile(prompts, "prompt sent", "prompts sent"),
      recap.pullRequests === undefined
        ? tile(recap.sessions, "agent session", "agent sessions")
        : tile(recap.pullRequests, "pull request opened", "pull requests opened"),
    ],
    linesAdded: `+${recap.linesAdded.toLocaleString()}`,
    linesRemoved: `−${recap.linesRemoved.toLocaleString()}`,
    mix: agentMix(recap.agents),
    projects: projectsText(recap.projects, agentMs),
    streak: streakLabel(on),
    days: recap.days.map((day, i) => ({
      letter: narrowWeekday.format(new Date(`${day.date}T12:00:00`)),
      on: on[i],
    })),
    empty: agentMs === 0,
  };
}

/** The words that go with the card's link when it's posted. */
export function recapCaption(view: RecapView): string {
  const parts = [`${view.hours} of agents working for me`, `${view.prompts} prompts`];
  if (view.pullRequests) parts.push(`${view.pullRequests} pull requests`);
  return `My week in lpm: ${parts.join(", ")}.`;
}
