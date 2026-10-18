import { PeerInvoke } from "../../bridge/commands";
import {
  normalizeAccounts,
  normalizeStatuses,
  normalizeUsage,
  type ClaudeAccountStatus,
} from "../store/accounts";
import type { ClaudePool, PoolPatch } from "../store/claudePool";
import type { ClaudeAccount } from "../types";
import { prefixName } from "./markers";
import { routedInvoke } from "./route";

// The Claude accounts a machine's projects can use, in the shapes its own
// Settings reads them.
export interface MachineClaudeAccounts {
  accounts: ClaudeAccount[];
  statuses: Record<string, ClaudeAccountStatus>;
  // Which projects use each account, by display name.
  usage: Record<string, string[]>;
  pool: ClaudePool | null;
}

const READ_CMD = "host_claude_accounts";

// A host's pools are named by its own projects; here they go by this Mac's names.
function translatePool(slug: string, raw: unknown): ClaudePool | null {
  if (!raw || typeof raw !== "object") return null;
  const pool = raw as ClaudePool;
  return {
    ...pool,
    pools: (pool.pools ?? []).map((p) => (p.project ? { ...p, project: prefixName(slug, p.project) } : p)),
  };
}

// A paired machine's accounts in one answer (hostclaude.rs). A host too old to
// share them fails the read.
export async function readHostClaude(slug: string): Promise<MachineClaudeAccounts> {
  const raw = (await PeerInvoke(slug, READ_CMD, {})) as { pool?: unknown } | null;
  return {
    accounts: normalizeAccounts(raw),
    statuses: normalizeStatuses(raw),
    usage: normalizeUsage(raw),
    pool: translatePool(slug, raw?.pool),
  };
}

export async function saveHostAccounts(slug: string, accounts: ClaudeAccount[]): Promise<void> {
  await PeerInvoke(slug, "save_claude_accounts", { a: { accounts } });
}

export async function removeHostAccount(slug: string, id: string): Promise<void> {
  await PeerInvoke(slug, "remove_claude_account", { id });
}

export async function updateHostPool(slug: string, patch: PoolPatch): Promise<ClaudePool | null> {
  return translatePool(slug, await PeerInvoke(slug, "set_claude_pool", { patch }));
}

export async function resumeHostPool(slug: string): Promise<ClaudePool | null> {
  return translatePool(slug, await PeerInvoke(slug, "resume_claude_pool", {}));
}

// Sign in to one of a machine's accounts in a terminal running there, attached
// here like any of its terminals. The marked `machine` is what routes it: the
// command takes no project.
export function startHostClaudeLogin(slug: string, accountId: string): Promise<string> {
  return routedInvoke("start_claude_login", { accountId, machine: prefixName(slug, "") }) as Promise<string>;
}
