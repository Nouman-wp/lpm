import { isValidAgentSessionId, type AgentSessionRef } from "../agentSession";
import { isPeerName, peerRawName } from "./markers";

// A terminal running on a peer host, as the host lists it for a project. The id
// is peer-marked; the label is the host's tab name, absent when it has none, and
// the agent session is the conversation the host's tab runs, from a host that
// says.
export interface HostTerminal {
  id: string;
  label?: string;
  pinned: boolean;
  emoji?: string;
  agentSession?: AgentSessionRef;
}

// Peer terminals this Mac has had a tab for. A sync never opens one of these
// again: a tab the user just closed can still be alive on the host for a moment
// (its stop in flight, or held behind the undo toast), and reopening it would
// undo the close.
const claimed = new Set<string>();

// Terminal starts sent to each host that haven't answered yet. The host can list
// a new terminal before its id comes back here, and adopting it then would open
// it twice: once from the listing, once from the start that asked for it.
const startsInFlight = new Map<string, number>();

export function claimPeerTerminal(id: string): void {
  if (isPeerName(id)) claimed.add(id);
}

// Let a sync open this terminal again: the host closed its tab, and undoing that
// close there brings the tab back.
export function releasePeerTerminal(id: string): void {
  claimed.delete(id);
}

export function beginPeerStart(slug: string): void {
  startsInFlight.set(slug, (startsInFlight.get(slug) ?? 0) + 1);
}

export function endPeerStart(slug: string): void {
  const left = (startsInFlight.get(slug) ?? 0) - 1;
  if (left > 0) startsInFlight.set(slug, left);
  else startsInFlight.delete(slug);
}

export function isPeerStartInFlight(slug: string): boolean {
  return startsInFlight.has(slug);
}

function parseAgentSession(value: unknown): AgentSessionRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const s = value as { provider?: unknown; sessionId?: unknown };
  if (s.provider !== "claude" && s.provider !== "codex") return undefined;
  if (typeof s.sessionId !== "string" || !isValidAgentSessionId(s.sessionId)) return undefined;
  return { provider: s.provider, sessionId: s.sessionId };
}

function parseHostTerminal(value: unknown): HostTerminal | null {
  if (!value || typeof value !== "object") return null;
  const t = value as {
    id?: unknown;
    label?: unknown;
    pinned?: unknown;
    emoji?: unknown;
    agentSession?: unknown;
  };
  if (typeof t.id !== "string" || !isPeerName(t.id)) return null;
  // A host with no name for a tab reports its pty id instead.
  const label =
    typeof t.label === "string" && t.label && t.label !== peerRawName(t.id) ? t.label : undefined;
  const emoji = typeof t.emoji === "string" && t.emoji ? t.emoji : undefined;
  const agentSession = parseAgentSession(t.agentSession);
  return { id: t.id, label, pinned: t.pinned === true, emoji, agentSession };
}

// The host's terminals that should open as tabs here: everything it lists that
// this Mac has never had a tab for. `openIds` are the tabs open now, claimed on
// the way so a later close can't bring them back.
export function unclaimedHostTerminals(
  listed: unknown,
  openIds: Iterable<string>,
): HostTerminal[] {
  for (const id of openIds) claimPeerTerminal(id);
  return hostTerminalsOf(listed).filter((t) => !claimed.has(t.id));
}

// Every terminal the host lists, in its tab order.
export function hostTerminalsOf(listed: unknown): HostTerminal[] {
  if (!Array.isArray(listed)) return [];
  return listed.map(parseHostTerminal).filter((t): t is HostTerminal => t !== null);
}

// What a host answers for a project: its live terminals and, from a host that
// reports them, the ids of every tab it has open — finished ones included — and
// the app run they belong to. `follow` says the host keeps the tabs' names and
// order for every Mac (see hostFollows).
export interface HostListing {
  terminals: unknown;
  tabs: string[] | null;
  run: string | null;
  follow: boolean;
}

export function parseHostListing(value: unknown): HostListing {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { terminals: value, tabs: null, run: null, follow: false };
  }
  const v = value as { terminals?: unknown; tabs?: unknown; run?: unknown; follow?: unknown };
  return {
    terminals: v.terminals,
    tabs: Array.isArray(v.tabs) ? v.tabs.filter((id): id is string => typeof id === "string") : null,
    run: typeof v.run === "string" ? v.run : null,
    follow: v.follow === true,
  };
}

// The tabs here a restarted host no longer has: after a restart it brings its
// tabs back under new ids, so the old ones it doesn't list are candidates to
// ask about. Null when the host didn't restart since the last listing.
export function tabsLeftByRestart(
  previousRun: string | null,
  listing: HostListing,
  openIds: Iterable<string>,
): string[] | null {
  if (!listing.follow || !listing.tabs || previousRun === null || listing.run === previousRun) {
    return null;
  }
  const open = new Set(listing.tabs);
  return [...openIds].filter((id) => isPeerName(id) && !open.has(id));
}

// The host tabs this Mac has seen open during one run of the host's app.
export interface HostTabsSeen {
  run: string | null;
  ids: Set<string>;
}

// The tabs here that the host has closed: ones it listed as open earlier in the
// same run and no longer does. A tab this Mac just opened there, which the host
// lists a moment later, was never seen and so is never taken for closed. After
// the host restarts nothing is: its terminals ended with it, and their tabs here
// stay, saying so.
export function hostClosedTabs(
  seen: HostTabsSeen,
  listing: HostListing,
  openIds: Iterable<string>,
): string[] {
  if (!listing.tabs) return [];
  if (listing.run !== seen.run) {
    seen.run = listing.run;
    seen.ids.clear();
  }
  const open = new Set(listing.tabs);
  for (const id of listing.tabs) seen.ids.add(id);
  return [...openIds].filter((id) => seen.ids.has(id) && !open.has(id));
}
