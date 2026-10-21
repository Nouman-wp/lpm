import type { CommandMap } from "../backend";
import { omittedProjects, seedData } from "./state";

const stats = (days: unknown) => seedData().stats(Number(days) || 0, omittedProjects());

export const usageCommands: CommandMap = {
  agent_usage_stats: ({ days }) => stats(days),
  agent_usage_machines: ({ days }) => ({ machine: "local", stats: stats(days), machines: [] }),
  agent_limits: () => seedData().usage.limits,
  claude_accounts_status: () => seedData().usage.accountsStatus ?? { statuses: [] },
  claude_account_usage: () => seedData().usage.accountUsage,
};
