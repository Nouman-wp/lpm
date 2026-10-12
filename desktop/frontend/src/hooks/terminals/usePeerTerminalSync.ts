import { useEffect, type RefObject } from "react";
import { ListProjectTerminals } from "../../../bridge/commands";
import { EventsOn } from "../../../bridge/runtime";
import { IS_MIRROR_WINDOW } from "../../mirror";
import { isPeerName, peerSlugOf } from "../../peer/markers";
import {
  type HostListing,
  type HostTabsSeen,
  claimPeerTerminal,
  hostClosedTabs,
  isPeerStartInFlight,
  parseHostListing,
  releasePeerTerminal,
  unclaimedHostTerminals,
} from "../../peer/hostTerminals";
import { noteOpenedByOtherMac } from "../../peer/openedByOtherMac";
import { pendingClosesForProject } from "../../pendingClose";
import { type PaneNode, collectTerminals } from "../../paneTree";
import { onTerminalsClosed } from "../../sendLater/closeout";
import { withHostTabs, withoutHostTabs } from "./hostTabs";

// A start still waiting on its reply holds a sync back; this is how soon it
// tries again.
const START_RETRY_MS = 1000;

interface UsePeerTerminalSyncProps {
  projectName: string;
  treeRef: RefObject<PaneNode | null>;
  focusedRef: RefObject<string | null>;
  restoreSettled: RefObject<Promise<void>>;
  applyTree: (next: PaneNode | null, focus?: string | null) => void;
}

// A peer project shows what runs on the host, not just what this Mac opened
// there: an agent started at the host's own keyboard, from a phone or from
// another Mac opens here as a tab too, and a tab closed there closes here.
// Synced when the project mounts, when the host's tabs change, and when this
// window comes back into focus.
export function usePeerTerminalSync({
  projectName,
  treeRef,
  focusedRef,
  restoreSettled,
  applyTree,
}: UsePeerTerminalSyncProps) {
  useEffect(() => {
    if (IS_MIRROR_WINDOW || !isPeerName(projectName)) return;
    const slug = peerSlugOf(projectName)!;
    let disposed = false;
    let running = false;
    let rerun = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const seen: HostTabsSeen = { run: null, ids: new Set() };

    const adopt = (listed: unknown) => {
      const tree = treeRef.current;
      const openIds = [
        ...(tree ? collectTerminals(tree).map((t) => t.id) : []),
        ...pendingClosesForProject(projectName).map((p) => p.tab.id),
      ];
      const fresh = unclaimedHostTerminals(listed, openIds);
      if (fresh.length === 0) return;
      for (const t of fresh) {
        claimPeerTerminal(t.id);
        noteOpenedByOtherMac(t.id);
      }
      const next = withHostTabs(tree, focusedRef.current, fresh);
      applyTree(next.tree, next.focus);
      // A create resuming before the re-render must append to this tree.
      treeRef.current = next.tree;
    };

    const dropClosed = (listing: HostListing) => {
      const tree = treeRef.current;
      if (!tree) return;
      const tabs = collectTerminals(tree);
      const closed = new Set(hostClosedTabs(seen, listing, tabs.map((t) => t.id)));
      if (closed.size === 0) return;
      closed.forEach(releasePeerTerminal);
      const next = withoutHostTabs(tree, focusedRef.current, closed);
      applyTree(next.tree, next.focus);
      treeRef.current = next.tree;
      onTerminalsClosed(
        projectName,
        tabs.filter((t) => closed.has(t.id)).map((t) => t.historyKey),
      );
    };

    const sync = async () => {
      if (running) {
        rerun = true;
        return;
      }
      running = true;
      try {
        await restoreSettled.current;
        const listed = await ListProjectTerminals(projectName, true).catch(() => null);
        if (disposed || listed === null) return;
        if (isPeerStartInFlight(slug)) {
          if (!retry) {
            retry = setTimeout(() => {
              retry = null;
              void sync();
            }, START_RETRY_MS);
          }
          return;
        }
        const listing = parseHostListing(listed);
        adopt(listing.terminals);
        dropClosed(listing);
      } finally {
        running = false;
        if (rerun && !disposed) {
          rerun = false;
          void sync();
        }
      }
    };

    void sync();
    const offChanged = EventsOn("terminals-changed", (project: string) => {
      if (project === projectName) void sync();
    });
    const onFocus = () => void sync();
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      offChanged();
      window.removeEventListener("focus", onFocus);
    };
  }, [projectName, applyTree]);
}
