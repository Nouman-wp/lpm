import { create } from "zustand";
import { PeerJoinedShares, PeerShares } from "../../bridge/commands";
import { EventsOn } from "../../bridge/runtime";

// Tabs this machine shares with other people (hosted), and tabs other people
// shared with it (joined). Rust holds both; this mirrors them for the UI and
// refreshes on the events each side emits. See src-tauri/src/tabshare.rs and
// src-tauri/src/peerclient/share.rs.

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
  hosted: HostedShare[];
  joined: JoinedTab[];
  shareDialog: ShareTarget | null;
  joinDialog: { invite: string } | null;
  openTab: string | null;
  setHosted: (hosted: HostedShare[]) => void;
  setJoined: (joined: JoinedTab[]) => void;
  openShareDialog: (target: ShareTarget) => void;
  closeShareDialog: () => void;
  openJoinDialog: (invite?: string) => void;
  closeJoinDialog: () => void;
  setOpenTab: (slug: string | null) => void;
}

export const useTabShares = create<TabSharesState>((set) => ({
  hosted: [],
  joined: [],
  shareDialog: null,
  joinDialog: null,
  openTab: null,
  setHosted: (hosted) => set({ hosted }),
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

function noteTyped({ share, guest, at }: { share: string; guest: string; at: number }) {
  const { hosted, setHosted } = useTabShares.getState();
  setHosted(
    hosted.map((h) =>
      h.id === share
        ? { ...h, guests: h.guests.map((g) => (g.id === guest ? { ...g, typedAt: at } : g)) }
        : h,
    ),
  );
}

let watching = false;

// Idempotent; called by the components that show shares.
export function watchTabShares(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  EventsOn("peer-share-changed", () => void refreshHostedShares());
  EventsOn("peer-share-typed", noteTyped);
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
