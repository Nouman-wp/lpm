import type { WeeklyRecap } from "../../../components/recap/weeklyRecapModel";
import { addDays } from "../../../components/stats/statsDates";
import { HOUR, MINUTE } from "./clock";

// Agent minutes and prompts per day, Monday first; Sunday off.
const WEEK = [
  { minutes: 352, prompts: 38 },
  { minutes: 418, prompts: 41 },
  { minutes: 296, prompts: 33 },
  { minutes: 389, prompts: 36 },
  { minutes: 241, prompts: 29 },
  { minutes: 184, prompts: 37 },
  { minutes: 0, prompts: 0 },
];

const PROJECTS = [
  { name: "saas-app", share: 0.41 },
  { name: "auth-service", share: 0.24 },
  { name: "docs-site", share: 0.16 },
  { name: "ml-pipeline", share: 0.12 },
  { name: "mobile-app", share: 0.07 },
];

export function sampleRecap(week: string): WeeklyRecap {
  const total = WEEK.reduce((sum, day) => sum + day.minutes, 0) * MINUTE;
  return {
    week,
    days: WEEK.map((day, i) => ({
      date: addDays(week, i),
      agentMs: day.minutes * MINUTE,
      prompts: day.prompts,
    })),
    previousAgentMs: total - 7 * HOUR,
    sessions: 58,
    projects: PROJECTS.map(({ name, share }) => ({ name, agentMs: Math.round(total * share) })),
    agents: [
      { name: "claude", agentMs: Math.round(total * 0.64) },
      { name: "codex", agentMs: Math.round(total * 0.36) },
    ],
    workedRepos: [
      "github.com/acme/auth-service",
      "github.com/acme/ml-pipeline",
      "github.com/acme/mobile-app",
      "github.com/acme/saas-app",
    ],
    linesAdded: 6_120,
    linesRemoved: 2_407,
  };
}
