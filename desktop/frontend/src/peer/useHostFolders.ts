import { useEffect } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { EventsOn } from "../../bridge/runtime";
import {
  dropMove,
  editHostFolders,
  foldedIds,
  folderNamed,
  groupOf,
  readHostFolders,
  slotAfter,
  slotAfterFolder,
  withFolds,
  type HostFolderOp,
  type HostFolders,
} from "./hostFolders";
import { peerSlugOf } from "./markers";
import { parseCollapsedMap } from "./peerSectionCollapse";
import { movePeerRow } from "../components/peerRowOrder";
import type { PeerClient } from "./usePeerState";

const COLLAPSED_KEY = "lpm-peer-folders-collapsed";
// What the host sends when its layout may have moved: its own edits, and a
// project coming or going (which takes it out of its folder too). The latter
// also stands in for any event the connection dropped.
const RELOAD_ON = new Set(["sidebar-changed", "projects-changed"]);

interface HostFoldersState {
  /// By peer slug, for each connected host that shares its folders, folded as
  /// the host keeps them (as this Mac keeps them, for a host that predates that).
  bySlug: Record<string, HostFolders>;
  /// "<slug>/<group id>" for each folder folded away on this Mac, of the hosts
  /// that leave folding to it.
  collapsed: Record<string, boolean>;
}

// The hosts that keep which of their folders are folded (hostFolderFolds).
const foldingHosts = new Set<string>();

function readCollapsed(): Record<string, boolean> {
  try {
    return parseCollapsedMap(localStorage.getItem(COLLAPSED_KEY));
  } catch {
    return {};
  }
}

export const useHostFolders = create<HostFoldersState>(() => ({
  bySlug: {},
  collapsed: readCollapsed(),
}));

function collapseKey(slug: string, groupId: string): string {
  return `${slug}/${groupId}`;
}

// The newest request per host wins. The host answers in the order it was asked,
// so an older answer arriving later is the one thing that could undo a newer one.
const latest = new Map<string, number>();

function begin(slug: string): number {
  const seq = (latest.get(slug) ?? 0) + 1;
  latest.set(slug, seq);
  return seq;
}

function adopt(slug: string, seq: number, folders: HostFolders) {
  if (latest.get(slug) !== seq) return;
  useHostFolders.setState((s) => ({
    bySlug: {
      ...s.bySlug,
      [slug]: foldingHosts.has(slug) ? folders : withFolds(folders, foldedHere(s.collapsed, slug)),
    },
  }));
}

async function reload(slug: string) {
  const seq = begin(slug);
  try {
    adopt(slug, seq, await readHostFolders(slug));
  } catch {
    // Unchanged until the next event or reconnect; the rows still show, unfiled.
  }
}

export async function applyHostFolderOp(slug: string, op: HostFolderOp): Promise<void> {
  const seq = begin(slug);
  try {
    adopt(slug, seq, await editHostFolders(slug, op));
  } catch (err) {
    toast.error(`Couldn't change the folders there: ${err}`);
    void reload(slug);
  }
}

// File a host's project into one of its folders, or (null) take it out to the
// slot just below the folder it was in.
export function fileHostProject(slug: string, name: string, groupId: string | null) {
  const folders = useHostFolders.getState().bySlug[slug];
  if (!folders) return;
  if (groupId !== null) {
    void applyHostFolderOp(slug, { op: "move", item: name, folder: groupId, before: null });
    return;
  }
  const current = groupOf(folders, name);
  if (!current) return;
  void applyHostFolderOp(slug, {
    op: "move",
    item: name,
    folder: null,
    before: slotAfterFolder(folders, current.id),
  });
}

// Copies just made on paired machines, each filed into its own machine's
// folder called `name`: the one it has, or a new one just below the project the
// copies came from there. This Mac's own copies are left to its own sidebar.
export async function fileCopiesOnHosts(name: string, copies: string[], sources: string[]): Promise<void> {
  const bySlug = new Map<string, string[]>();
  for (const copy of copies) {
    const slug = peerSlugOf(copy);
    if (slug) bySlug.set(slug, [...(bySlug.get(slug) ?? []), copy]);
  }
  for (const [slug, onHost] of bySlug) {
    const folders = useHostFolders.getState().bySlug[slug];
    if (!folders) continue;
    const folder = folderNamed(folders, name);
    if (!folder) {
      const source = sources.find((s) => peerSlugOf(s) === slug) ?? onHost[0];
      await applyHostFolderOp(slug, { op: "create", name, members: onHost, before: slotAfter(folders, source) });
      continue;
    }
    for (const item of onHost) {
      await applyHostFolderOp(slug, { op: "move", item, folder: folder.id, before: null });
    }
  }
}

// A row of a host's section dropped onto another; `rows` is every row of the
// section in the order they render. A copy only sorts among its siblings.
// False when the host doesn't share its folders, and the drop is this Mac's own
// ordering to keep.
export function dropHostRow(
  slug: string,
  rows: string[],
  active: string,
  over: string,
  siblings?: string[],
): boolean {
  const folders = useHostFolders.getState().bySlug[slug];
  if (!folders) return false;
  if (siblings) {
    const order = movePeerRow(siblings, active, over);
    if (order) void applyHostFolderOp(slug, { op: "copies", order });
    return true;
  }
  const op = dropMove(folders, rows, active, over);
  if (op) void applyHostFolderOp(slug, op);
  return true;
}

export function toggleHostFolder(slug: string, groupId: string) {
  const { collapsed, bySlug } = useHostFolders.getState();
  const folders = bySlug[slug];
  const group = folders?.groups.find((g) => g.id === groupId);
  if (!folders || !group) return;
  const fold = !group.collapsed;
  const folded = foldedIds(folders);
  if (fold) folded.add(groupId);
  else folded.delete(groupId);
  // Shown at once; a host that keeps folds answers with the same layout.
  useHostFolders.setState((s) => ({ bySlug: { ...s.bySlug, [slug]: withFolds(folders, folded) } }));
  if (foldingHosts.has(slug)) {
    void applyHostFolderOp(slug, { op: "fold", id: groupId, collapsed: fold });
    return;
  }
  // Folders the host has since dropped go with this write, for this host only:
  // the others' folders aren't on hand to check against while they are away.
  const next: Record<string, boolean> = {};
  for (const k of Object.keys(collapsed)) if (!k.startsWith(`${slug}/`)) next[k] = true;
  for (const id of folded) next[collapseKey(slug, id)] = true;
  useHostFolders.setState({ collapsed: next });
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
  } catch {
    /* storage may be full or disabled */
  }
}

// Keep the folders of every connected host that shares them, re-read whenever
// the host says they may have changed.
export function useHostFoldersSync(peers: PeerClient[]) {
  const sharing = peers.filter((p) => p.connected && p.supportsHostFolders);
  const key = sharing
    .map((p) => p.slug)
    .sort()
    .join(",");
  const folding = sharing
    .filter((p) => p.supportsHostFolderFolds)
    .map((p) => p.slug)
    .sort()
    .join(",");
  useEffect(() => {
    const slugs = key ? key.split(",") : [];
    foldingHosts.clear();
    for (const slug of folding ? folding.split(",") : []) foldingHosts.add(slug);
    useHostFolders.setState((s) => ({
      bySlug: Object.fromEntries(Object.entries(s.bySlug).filter(([slug]) => slugs.includes(slug))),
    }));
    const offs = slugs.map((slug) => {
      void reload(slug);
      return EventsOn(`peer-evt-${slug}`, (event: { name?: string } | null) => {
        if (event?.name && RELOAD_ON.has(event.name)) void reload(slug);
      });
    });
    return () => offs.forEach((off) => off());
  }, [key, folding]);
}

// The folder menu and dialogs a host's folders open, rendered once by
// PeerFolderMenus.
export interface HostFolderDialogs {
  menu: { slug: string; id: string; x: number; y: number } | null;
  renaming: { slug: string; id: string } | null;
  creating: { slug: string; members?: string[] } | null;
}

export const useHostFolderDialogs = create<HostFolderDialogs>(() => ({
  menu: null,
  renaming: null,
  creating: null,
}));

// The ids of a host's folders folded away on this Mac.
function foldedHere(collapsed: Record<string, boolean>, slug: string): Set<string> {
  const prefix = `${slug}/`;
  return new Set(
    Object.keys(collapsed)
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length)),
  );
}
