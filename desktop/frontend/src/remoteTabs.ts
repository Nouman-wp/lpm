import { agentSessionOf, type AgentSessionRef } from "./agentSession";
import { canForkSession } from "./forkSession";
import { followsAgentTitle, terminalDisplayLabel, type TerminalInstance } from "./paneTree";
import { peerSlugOf } from "./peer/markers";
import { detectAICLI } from "./slashCommands";

// One terminal tab as phones and paired Macs see it. `cli` is detected from the
// launch command (empty for plain shells). `agentSession` is the conversation
// whose transcript the phone's copy key reads, so only for tabs whose
// transcripts are on this Mac. The `can*` flags gate the phone's tab menu the
// way the desktop's own tab menu is gated.
export interface RemoteTab {
  id: string;
  label: string;
  cli: string;
  pinned: boolean;
  emoji: string;
  historyKey: string;
  agentSession: AgentSessionRef | null;
  canFork: boolean;
  canForkCopy: boolean;
  canTitle: boolean;
}

export function remoteTabOf(
  t: TerminalInstance,
  { localSessions, sessionsReachable }: { localSessions: boolean; sessionsReachable: boolean },
): RemoteTab {
  const canFork = canForkSession(t.resumeCmd);
  return {
    id: t.id,
    label: terminalDisplayLabel(t),
    cli: detectAICLI(t.startCmd) ?? "",
    pinned: t.pinned === true,
    emoji: t.emoji ?? "",
    // Same fallback the composer uses: an older persisted tree can carry a tab
    // that predates history keys.
    historyKey: t.historyKey ?? t.id,
    agentSession: localSessions && peerSlugOf(t.id) === null ? agentSessionOf(t) : null,
    canFork,
    canForkCopy: canFork && sessionsReachable,
    canTitle: !followsAgentTitle(t) && !!agentSessionOf(t),
  };
}

export function sameRemoteTabs(a: RemoteTab[], b: RemoteTab[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (p, i) =>
        p.id === b[i].id &&
        p.label === b[i].label &&
        p.cli === b[i].cli &&
        p.pinned === b[i].pinned &&
        p.emoji === b[i].emoji &&
        p.historyKey === b[i].historyKey &&
        p.agentSession?.provider === b[i].agentSession?.provider &&
        p.agentSession?.sessionId === b[i].agentSession?.sessionId &&
        p.canFork === b[i].canFork &&
        p.canForkCopy === b[i].canForkCopy &&
        p.canTitle === b[i].canTitle,
    )
  );
}
