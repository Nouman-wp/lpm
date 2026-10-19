import { create } from "zustand";
import { PeerJoinedShares, PeerShares } from "../../bridge/commands";
import { EventsOn } from "../../bridge/runtime";

// Tabs this machine shares with other people (hosted), and tabs other people
// shared with it (joined). Rust holds both; this mirrors them for the UI and
// refreshes on the events each side emits. See src-tauri/src/tabshare.rs and
// src-tauri/src/peerclient/share.rs.

export interface ShareGuest {
  id: string;
  name: string;
  joinedAt: number;
  connected: boolean;
}

export interface ShareWaiting {
  id: string;
  name: string;
}

export interface HostedShare {
  id: string;
  terminalId: string;
  project: string;
  label: string;
  canType: boolean;
  invite: string;
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
  connected: boolean;
  // Why the host ended it; empty while it's live.
  ended: string;
  lastError: string;
  cols: number | null;
  rows: number | null;
  joinedAt: number;
}

export interface ShareTarget {
  terminalId: string;
  project: string;
  label: string;
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

let watching = false;

// Idempotent; called by the components that show shares.
export function watchTabShares(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  EventsOn("peer-share-changed", () => void refreshHostedShares());
  EventsOn("peer-joined-changed", () => void refreshJoinedTabs());
  EventsOn("peer-state-changed", () => void refreshJoinedTabs());
  void refreshHostedShares();
  void refreshJoinedTabs();
}

export function useHostedShare(terminalId: string): HostedShare | undefined {
  return useTabShares((s) => s.hosted.find((h) => h.terminalId === terminalId));
}
