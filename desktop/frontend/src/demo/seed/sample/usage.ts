import type { ProviderLimits } from "../../../hooks/useAgentLimits";
import { DAY, HOUR, MINUTE } from "./clock";

const nowSecs = () => Math.floor(Date.now() / 1000);
const resetsIn = (ms: number) => nowSecs() + Math.round(ms / 1000);

// `agent_limits`: one entry per Claude account (`claude:<account>`) and one
// for Codex. The pace tick reads off how far off each reset is.
export function sampleLimits(): Record<string, ProviderLimits> {
  const now = Date.now();
  return {
    "claude:default": {
      provider: "claude",
      accountId: "default",
      label: "max",
      fiveHour: { usedPercent: 41, resetsAt: resetsIn(2 * HOUR + 14 * MINUTE) },
      weekly: { usedPercent: 65, resetsAt: resetsIn(18 * HOUR + 29 * MINUTE) },
      updatedAt: now - 2 * MINUTE,
    },
    codex: {
      provider: "codex",
      label: "pro",
      fiveHour: { usedPercent: 12, resetsAt: resetsIn(4 * HOUR + 36 * MINUTE) },
      weekly: { usedPercent: 27, resetsAt: resetsIn(5 * DAY + 13 * HOUR) },
      updatedAt: now - 6 * MINUTE,
    },
  };
}

// `claude_accounts_status`: the main login, with the email its cards show.
export const SAMPLE_ACCOUNTS_STATUS = {
  statuses: [{ id: "default", signedIn: true, email: "you@example.com" }],
};

// `claude_account_usage`: no project is pinned to an account.
export const SAMPLE_ACCOUNT_USAGE = { usage: {} };

