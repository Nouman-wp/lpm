import { useEffect, useState } from "react";
import { ClaudeLimitsAccount } from "../../bridge/commands";
import { MAIN_LOGIN } from "../claudePoolText";
import type { MachineClaudeAccounts } from "../peer/hostClaude";
import { peerSlugOf } from "../peer/markers";
import { projectAccount, projectPool } from "../claudeProjectPool";
import { useAppStore } from "../store/app";

export interface ProjectClaudeAccounts {
  /** The account new sessions use, as its limits key ("default" is the main login). */
  current: string;
  /** The rest of the project's pool, which it can switch to while switching is on. */
  standby: string[];
}

/** Which Claude account a project's new sessions run on, among `machine`'s:
 *  the accounts of the machine it is on (useClaudeAccountsOf), this Mac or a
 *  paired one. An SSH project runs on the far side's login, so it has none
 *  here. Pins and pools resolve from state already here, so switching projects
 *  never waits on the backend; only lpm's own login is asked for, and it is
 *  the same for every project on a machine. */
export function useProjectClaudeAccounts(
  name: string | null,
  machine: MachineClaudeAccounts | null,
): ProjectClaudeAccounts | null {
  const projects = useAppStore((s) => s.projects);
  const [ambient, setAmbient] = useState<Record<string, string>>({});

  const project = name ? projects.find((p) => p.name === name) : undefined;
  const own = project && !project.isRemote ? project : undefined;
  const pool = machine?.pool ?? null;
  const machineKey = peerSlugOf(own?.name) ?? "";
  const derived =
    own && machine
      ? projectAccount(
          own,
          projects,
          pool,
          machine.accounts.map((a) => a.id),
        )
      : null;
  // Before the pool state arrives a pool's account is unknown, and the backend's
  // answer would be that pool's pick rather than lpm's own login.
  const lookup = own && derived === null && pool ? own.name : null;

  useEffect(() => {
    if (!lookup) return;
    let alive = true;
    ClaudeLimitsAccount(lookup)
      .then((id: string) => alive && setAmbient((prev) => ({ ...prev, [machineKey]: id || MAIN_LOGIN })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lookup, machineKey]);

  if (!own) return null;
  const current = derived ?? (pool ? ambient[machineKey] : null);
  if (!current) return null;
  const view = pool?.active ? projectPool(own, projects, pool) : undefined;
  return {
    current,
    standby: view ? view.members.filter((id) => id !== current) : [],
  };
}
