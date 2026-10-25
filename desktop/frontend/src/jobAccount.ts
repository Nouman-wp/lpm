import { MAIN_LOGIN } from "./claudePoolText";
import { projectJobAccount } from "./claudeProjectPool";
import type { ProjectInfo } from "./types";

export interface JobScope {
  // The projects it runs in; empty and not everyProject = standalone.
  targets: string[];
  everyProject: boolean;
}

/** The account an automation's runs use without one of its own: the main
 *  login for a standalone one, its projects' otherwise; null when they differ. */
export function jobDefaultAccount(scope: JobScope, projects: ProjectInfo[], registered: string[]): string | null {
  if (scope.everyProject) return null;
  if (scope.targets.length === 0) return MAIN_LOGIN;
  const ids = new Set(
    scope.targets.map((name) => {
      const project = projects.find((p) => p.name === name);
      return project ? projectJobAccount(project, projects, registered) : MAIN_LOGIN;
    }),
  );
  return ids.size === 1 ? [...ids][0] : null;
}

/** The account its runs use: `""` is the main login, and an account this
 *  machine no longer has leaves it to the projects, as the app does. */
export function jobAccountInUse(choice: string | null, fallback: string | null, registered: string[]): string | null {
  if (choice === null) return fallback;
  if (choice === "") return MAIN_LOGIN;
  return registered.includes(choice) ? choice : fallback;
}

function jobAccountRemoved(choice: string | null, registered: string[]): boolean {
  return choice !== null && choice !== "" && !registered.includes(choice);
}

/** What picking an account changes, said under the row; null when nothing. */
export function jobAccountNote(
  scope: JobScope,
  choice: string | null,
  registered: string[],
  inUse: string | null,
  fallback: string | null,
  label: (id: string) => string,
  projectName: (name: string) => string,
): string | null {
  if (jobAccountRemoved(choice, registered)) {
    const instead = fallback === null ? "each project's own account" : label(fallback);
    return `The account picked for this automation was removed, so it runs on ${instead}.`;
  }
  if (choice === null || inUse === null || inUse === fallback) return null;
  const name = label(inUse);
  if (scope.everyProject || scope.targets.length > 1) {
    return `Runs on ${name} in every project instead of each project's own account.`;
  }
  if (scope.targets.length === 0) return `Runs on ${name} instead of your main login.`;
  const project = projectName(scope.targets[0]);
  return `Runs on ${name} instead of ${project}'s account. Other Claude sessions in ${project} don't change.`;
}
