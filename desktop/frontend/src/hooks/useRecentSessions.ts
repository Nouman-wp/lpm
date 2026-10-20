import { useEffect, useMemo, useState } from "react";
import { listAgentSessions, mergeSessionRows, type AgentSessionSummary, type SessionRow } from "../agentSessions";
import type { PersistedHistoryEntry } from "../terminals";

// A few more than are shown, so rows the user hid don't leave the list short.
const FETCHED = 8;
const NO_OPEN_TABS = new Map<string, string>();

/** The project's newest resumable conversations, as the Resume list orders them;
 *  null until the agents' own stores have been read. */
export function useRecentSessions(
  projectName: string,
  history: PersistedHistoryEntry[],
  hidden: ReadonlySet<string>,
  count: number,
): SessionRow[] | null {
  const [sessions, setSessions] = useState<AgentSessionSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAgentSessions(projectName, FETCHED, "")
      .then((page) => !cancelled && setSessions(page.sessions))
      // A project whose agents run on another machine has no transcripts here;
      // its closed tabs still list.
      .catch(() => !cancelled && setSessions([]));
    return () => {
      cancelled = true;
    };
  }, [projectName]);

  return useMemo(
    () =>
      sessions &&
      mergeSessionRows({ history, sessions, open: NO_OPEN_TABS, search: "", hidden }).slice(0, count),
    [sessions, history, hidden, count],
  );
}
