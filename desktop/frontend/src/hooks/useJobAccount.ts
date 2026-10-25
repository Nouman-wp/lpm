import { accountLabel } from "../claudePoolText";
import { displayNameForProjectName } from "../components/ProjectNameDisplay";
import { useClaudeAccountsSource, type ClaudeAccountsSource } from "../components/settings/useClaudeAccountsSource";
import { jobAccountInUse, jobAccountNote, jobDefaultAccount, type JobScope } from "../jobAccount";
import { useAppStore } from "../store/app";
import type { ClaudeAccount } from "../types";

export interface JobAccount {
  // The Claude accounts of the machine the automation is saved on.
  source: ClaudeAccountsSource;
  // What following its projects is called, and the account that means; null
  // when its projects use different ones.
  defaultName: string;
  fallback: string | null;
  // The account its runs use; null when that differs by project.
  inUse: string | null;
  label: (id: string) => string;
  signedIn: (id: string) => boolean;
  note: string | null;
  // The account its runs use, when it needs signing in first.
  signedOut: ClaudeAccount | null;
}

/** Which Claude account an automation's runs use, among the accounts of the
 *  machine `host` (null for this one). Null while those are unknown. */
export function useJobAccount(choice: string | null, scope: JobScope, host: string | null): JobAccount | null {
  const source = useClaudeAccountsSource(host);
  const projects = useAppStore((s) => s.projects);
  if (!source) return null;

  const registered = source.accounts.map((a) => a.id);
  const label = (id: string) => accountLabel(id, source.pool, source.accounts);
  const projectName = (name: string) => displayNameForProjectName(name, projects);
  const signedIn = (id: string) =>
    source.pool?.accounts.find((a) => a.id === id)?.signedIn ?? source.statuses[id]?.signedIn ?? true;
  const fallback = jobDefaultAccount(scope, projects, registered);
  const inUse = jobAccountInUse(choice, fallback, registered);
  const account = source.accounts.find((a) => a.id === inUse);
  const several = scope.everyProject || scope.targets.length > 1;

  return {
    source,
    defaultName: several ? "Same as each project" : `Same as ${projectName(scope.targets[0] ?? "")}`,
    fallback,
    inUse,
    label,
    signedIn,
    note: jobAccountNote(scope, choice, registered, inUse, fallback, label, projectName),
    signedOut: account && !signedIn(account.id) ? account : null,
  };
}
