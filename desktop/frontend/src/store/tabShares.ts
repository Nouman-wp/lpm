import { create } from "zustand";
import { PeerInvoke, PeerJoinedShares, PeerShares } from "../../bridge/commands";
import { EventsOn } from "../../bridge/runtime";
import { subscribeEveryPeer, watchConnectedPeers, type ConnectedPeer } from "../peer/route";
import { prefixName } from "../peer/markers";

// Tabs this machine shares with other people (hosted), and tabs other people
// shared with it (joined). Rust holds both; this mirrors them for the UI and
// refreshes on the events each side emits. See src-tauri/src/tabshare.rs and
// src-tauri/src/peerclient/share.rs. Hosted also holds the tabs shared from
// here on each connected paired machine (tabshare/machines.rs), which only
// this machine is there to answer for when that one is headless.

export type ShareVia = "lpm" | "browser";

export function viaName(via?: ShareVia): string {
  return via === "browser" ? "a browser" : "lpm";
}

export interface ShareGuest {
  id: string;
  name: string;
  joinedAt: number;
  connected: boolean;
  canType: boolean;
  via: ShareVia;
  // Asked to type, and nobody has answered yet.
  asked: boolean;
  // When this machine last heard them type, in ms; 0 for never.
  typedAt: number;
}

export interface ShareWaiting {
  id: string;
  name: string;
  // Four emoji the person asking sees too.
  code?: string | null;
  via?: ShareVia;
}

export interface HostedShare {
  id: string;
  terminalId: string;
  project: string;
  label: string;
  // What people let in from now on may do.
  canType: boolean;
  invite: string;
  // The invite also opens in a browser, through the share relay.
  browser?: boolean;
  guests: ShareGuest[];
  waiting: ShareWaiting[];
  // The paired machine whose tab this is, which holds the share; absent for
  // this machine's own.
  machine?: string;
}

export interface JoinedTab {
  slug: string;
  hostName: string;
  host: string;
  // Prefixed (`peer-{slug}-{id}`) once the host has said which terminal it is.
  terminalId: string;
  label: string;
  project: string;
  canType: boolean;
  // Asked the host to type, with no answer yet.
  asked: boolean;
  // The host takes asking to type (an older lpm doesn't).
  askType: boolean;
  // Who else is watching, as the host last said.
  others: string[];
  connected: boolean;
  // Why the host ended it; empty while it's live.
  ended: string;
  lastError: string;
  cols: number | null;
  rows: number | null;
  joinedAt: number;
}

export interface ShareAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ShareTarget {
  terminalId: string;
  project: string;
  label: string;
  // What the share popover opens next to: the Share button, or where the tab
  // menu was.
  anchor: ShareAnchor;
}

interface TabSharesState {
  // This machine's shares, then each paired machine's.
  hosted: HostedShare[];
  // What each connected paired machine is called, by slug.
  machineNames: Record<string, string>;
  joined: JoinedTab[];
  shareDialog: ShareTarget | null;
  joinDialog: { invite: string } | null;
  openTab: string | null;
  // This machine's shares.
  setHosted: (hosted: HostedShare[]) => void;
  // A paired machine's shares, or null once it's gone.
  setMachineHosted: (slug: string, hosted: HostedShare[] | null) => void;
  setMachineNames: (names: Record<string, string>) => void;
  markTyped: (share: string, guest: string, at: number) => void;
  setJoined: (joined: JoinedTab[]) => void;
  openShareDialog: (target: ShareTarget) => void;
  closeShareDialog: () => void;
  openJoinDialog: (invite?: string) => void;
  closeJoinDialog: () => void;
  setOpenTab: (slug: string | null) => void;
}

export const useTabShares = create<TabSharesState>((set) => ({
  hosted: [],
  machineNames: {},
  joined: [],
  shareDialog: null,
  joinDialog: null,
  openTab: null,
  setHosted: (own) => set((s) => ({ hosted: [...own, ...s.hosted.filter((h) => h.machine)] })),
  setMachineHosted: (slug, rows) =>
    set((s) => {
      const others = s.hosted.filter((h) => h.machine !== slug);
      if (!rows && others.length === s.hosted.length) return s;
      return { hosted: [...others, ...(rows ?? [])] };
    }),
  setMachineNames: (machineNames) => set({ machineNames }),
  markTyped: (share, guest, at) =>
    set((s) => ({
      hosted: s.hosted.map((h) =>
        h.id === share
          ? { ...h, guests: h.guests.map((g) => (g.id === guest ? { ...g, typedAt: at } : g)) }
          : h,
      ),
    })),
  setJoined: (joined) => set({ joined }),
  openShareDialog: (target) => set({ shareDialog: target }),
  closeShareDialog: () => set({ shareDialog: null }),
  openJoinDialog: (invite = "") => set({ joinDialog: { invite } }),
  closeJoinDialog: () => set({ joinDialog: null }),
  setOpenTab: (slug) => set({ openTab: slug }),
}));

export function refreshHostedShares(): Promise<void> {
  return PeerShares()
    .then((rows: HostedShare[]) => useTabShares.getState().setHosted(rows ?? []))
    .catch(() => {});
}

export function refreshJoinedTabs(): Promise<void> {
  return PeerJoinedShares()
    .then((rows: JoinedTab[]) => useTabShares.getState().setJoined(rows ?? []))
    .catch(() => {});
}

interface Typed {
  share: string;
  guest: string;
  at: number;
}

function noteTyped({ share, guest, at }: Typed) {
  useTabShares.getState().markTyped(share, guest, at);
}

// A paired machine's rows, named the way this machine names its terminals.
function fromMachine(slug: string, rows: unknown): HostedShare[] {
  return ((rows as HostedShare[] | null) ?? []).map((row) => ({
    ...row,
    terminalId: prefixName(slug, row.terminalId),
    machine: slug,
  }));
}

// Each machine's latest ask, so an answer that comes late can't undo a newer one.
const machineAsks = new Map<string, number>();

function nextAsk(slug: string): number {
  const ask = (machineAsks.get(slug) ?? 0) + 1;
  machineAsks.set(slug, ask);
  return ask;
}

// What a share command run on a paired machine answered with: how its shares
// stand now.
export function applyMachineShares(slug: string, rows: unknown): HostedShare[] {
  nextAsk(slug);
  const shares = fromMachine(slug, rows);
  useTabShares.getState().setMachineHosted(slug, shares);
  return shares;
}

export function refreshMachineShares(slug: string): Promise<void> {
  const ask = nextAsk(slug);
  const latest = () => machineAsks.get(slug) === ask;
  return PeerInvoke(slug, "peer_shares", {})
    .then((rows: unknown) => {
      if (latest()) useTabShares.getState().setMachineHosted(slug, fromMachine(slug, rows));
    })
    .catch(() => {
      // An lpm there from before machines shared its tabs has none to list.
      if (latest()) useTabShares.getState().setMachineHosted(slug, null);
    });
}

// The paired machines connected when last heard. Each one's shares are read as
// it connects; its forwarded changes keep them current after that.
let connected = new Set<string>();

function syncMachines(peers: ConnectedPeer[]) {
  const { setMachineHosted, setMachineNames } = useTabShares.getState();
  setMachineNames(Object.fromEntries(peers.map((p) => [p.slug, p.alias])));
  const live = new Set(peers.map((p) => p.slug));
  for (const slug of connected) {
    if (live.has(slug)) continue;
    nextAsk(slug);
    setMachineHosted(slug, null);
  }
  for (const slug of live) if (!connected.has(slug)) void refreshMachineShares(slug);
  connected = live;
}

let watching = false;

// Idempotent; called by the components that show shares.
export function watchTabShares(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  EventsOn("peer-share-changed", () => void refreshHostedShares());
  EventsOn("peer-share-typed", noteTyped);
  watchConnectedPeers(syncMachines);
  subscribeEveryPeer("peer-share-changed", (slug) => void refreshMachineShares(slug));
  // Heard as it happens, by this machine's clock, which "typing now" reads.
  subscribeEveryPeer("peer-share-typed", (_slug, typed) =>
    noteTyped({ ...(typed as Typed), at: Date.now() }),
  );
  EventsOn("peer-joined-changed", () => void refreshJoinedTabs());
  EventsOn("peer-state-changed", () => void refreshJoinedTabs());
  void refreshHostedShares();
  void refreshJoinedTabs();
}

export function useHostedShare(terminalId: string): HostedShare | undefined {
  return useTabShares((s) => s.hosted.find((h) => h.terminalId === terminalId));
}

export function watchingCount(share: HostedShare): number {
  return share.guests.filter((g) => g.connected).length;
}

export function anyoneTypes(share: HostedShare): boolean {
  return share.guests.some((g) => g.canType);
}

// A shared tab's marks are amber while anyone may type, cyan while all watch.
export function shareTint(share: HostedShare): string {
  return anyoneTypes(share) ? "text-[var(--accent-amber)]" : "text-[var(--accent-cyan)]";
}
