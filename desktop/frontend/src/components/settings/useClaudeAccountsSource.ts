import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApplyClaudeLimits, StartClaudeLogin } from "../../../bridge/commands";
import {
  readHostClaude,
  removeHostAccount,
  resumeHostPool,
  saveHostAccounts,
  startHostClaudeLogin,
  updateHostPool,
  type MachineClaudeAccounts,
} from "../../peer/hostClaude";
import { useAccountsStore } from "../../store/accounts";
import { useClaudePoolStore, type ConsentRequest, type PoolPatch } from "../../store/claudePool";
import { useSettingsStore } from "../../store/settings";
import type { ClaudeAccount } from "../../types";

// The Claude accounts Settings shows and changes: this Mac's, kept in its
// stores, or a paired machine's, read from it and changed there.
export interface ClaudeAccountsSource extends MachineClaudeAccounts {
  // The paired machine's slug; null for this Mac.
  host: string | null;
  // Suggestions the person put off, which only this Mac keeps.
  dismissed: Record<string, string>;
  refresh: () => Promise<void>;
  add: (label: string) => Promise<ClaudeAccount>;
  rename: (id: string, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  updatePool: (patch: PoolPatch) => Promise<void>;
  resumePool: () => Promise<void>;
  askConsent: (request: ConsentRequest) => void;
  // Starts `claude /login` for an account and answers with its terminal.
  startLogin: (id: string) => Promise<string>;
  // Turns on the usage readings switching needs. A paired machine's readings
  // are its own to turn on, so it has none.
  turnOnReadings?: () => Promise<void>;
}

const NOTHING_DISMISSED: Record<string, string> = {};

function useLocalSource(): ClaudeAccountsSource {
  const accounts = useAccountsStore((s) => s.accounts);
  const statuses = useAccountsStore((s) => s.statuses);
  const usage = useAccountsStore((s) => s.usage);
  const add = useAccountsStore((s) => s.add);
  const rename = useAccountsStore((s) => s.rename);
  const remove = useAccountsStore((s) => s.remove);
  const pool = useClaudePoolStore((s) => s.pool);
  const dismissed = useClaudePoolStore((s) => s.dismissed);
  const refresh = useClaudePoolStore((s) => s.hydrate);
  const updatePool = useClaudePoolStore((s) => s.update);
  const resumePool = useClaudePoolStore((s) => s.resume);
  const askConsent = useClaudePoolStore((s) => s.askConsent);
  const updateSettings = useSettingsStore((s) => s.update);

  return useMemo(
    () => ({
      host: null,
      accounts,
      statuses,
      usage,
      pool,
      dismissed,
      refresh,
      add,
      rename,
      remove,
      updatePool,
      resumePool,
      askConsent,
      startLogin: (id: string) => StartClaudeLogin(id),
      turnOnReadings: async () => {
        try {
          await ApplyClaudeLimits(true);
          await updateSettings({ claudeLimitsEnabled: true });
        } catch (err) {
          toast.error(String(err));
        }
        await refresh();
      },
    }),
    [accounts, statuses, usage, pool, dismissed, refresh, add, rename, remove, updatePool, resumePool, askConsent, updateSettings],
  );
}

function useHostSource(slug: string | null): ClaudeAccountsSource | null {
  const [found, setFound] = useState<MachineClaudeAccounts | null>(null);
  const askConsent = useClaudePoolStore((s) => s.askConsent);

  const refresh = useCallback(async () => {
    if (slug) setFound(await readHostClaude(slug));
  }, [slug]);

  useEffect(() => {
    setFound(null);
    refresh().catch(() => {});
  }, [refresh]);

  return useMemo(() => {
    if (!slug || !found) return null;
    // A pool change is reported here, as this Mac's store reports its own.
    const changePool = async (change: () => Promise<MachineClaudeAccounts["pool"]>) => {
      try {
        const pool = await change();
        setFound((current) => current && { ...current, pool });
      } catch (err) {
        toast.error(String(err));
        throw err;
      }
    };
    return {
      ...found,
      host: slug,
      dismissed: NOTHING_DISMISSED,
      refresh,
      add: async (label) => {
        const account = { id: crypto.randomUUID(), label };
        await saveHostAccounts(slug, [...found.accounts, account]);
        await refresh();
        return account;
      },
      rename: async (id, label) => {
        await saveHostAccounts(slug, found.accounts.map((a) => (a.id === id ? { ...a, label } : a)));
        await refresh();
      },
      remove: async (id) => {
        await removeHostAccount(slug, id);
        await refresh();
      },
      updatePool: (patch) => changePool(() => updateHostPool(slug, patch)),
      resumePool: () => changePool(() => resumeHostPool(slug)),
      askConsent: (request) => {
        if (!found.pool) return;
        askConsent({
          ...request,
          host: { slug, pool: found.pool, accounts: found.accounts },
          onDone: async () => {
            await request.onDone?.();
            await refresh();
          },
        });
      },
      startLogin: (id) => startHostClaudeLogin(slug, id),
    };
  }, [slug, found, refresh, askConsent]);
}

// The accounts of this Mac, or of the paired machine `host`. Null while a
// machine's are loading, or from one too old to share them.
export function useClaudeAccountsSource(host: string | null): ClaudeAccountsSource | null {
  const local = useLocalSource();
  const remote = useHostSource(host);
  return host ? remote : local;
}
