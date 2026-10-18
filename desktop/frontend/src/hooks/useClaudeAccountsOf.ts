import { useEffect, useMemo, useState } from "react";
import { readHostClaude, type MachineClaudeAccounts } from "../peer/hostClaude";
import { peerSlugOf } from "../peer/markers";
import { useAccountsStore } from "../store/accounts";
import { useClaudePoolStore } from "../store/claudePool";

// The Claude accounts a project's sessions can use: this Mac's, or those of the
// paired machine it is on. Null while a machine's are loading, or from one too
// old to share them.
export function useClaudeAccountsOf(projectName: string | null): MachineClaudeAccounts | null {
  const slug = peerSlugOf(projectName);
  const accounts = useAccountsStore((s) => s.accounts);
  const statuses = useAccountsStore((s) => s.statuses);
  const usage = useAccountsStore((s) => s.usage);
  const pool = useClaudePoolStore((s) => s.pool);
  const [host, setHost] = useState<MachineClaudeAccounts | null>(null);

  useEffect(() => {
    setHost(null);
    if (!slug) return;
    let cancelled = false;
    readHostClaude(slug)
      .then((found) => {
        if (!cancelled) setHost(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const local = useMemo(() => ({ accounts, statuses, usage, pool }), [accounts, statuses, usage, pool]);
  return slug ? host : local;
}
