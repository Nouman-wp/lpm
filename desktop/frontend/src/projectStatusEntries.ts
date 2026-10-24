import { useAppStore } from "./store/app";
import { useGlobalAgentStatus } from "./store/globalAgentStatus";
import { GLOBAL_TERMINALS_KEY } from "./terminals";
import type { StatusEntry } from "./types";

// The status rows a project's agents report right now, read outside React.
export function projectStatusEntries(projectName: string): StatusEntry[] | undefined {
  return projectName === GLOBAL_TERMINALS_KEY
    ? useGlobalAgentStatus.getState().entries
    : useAppStore.getState().projects.find((p) => p.name === projectName)?.statusEntries;
}
