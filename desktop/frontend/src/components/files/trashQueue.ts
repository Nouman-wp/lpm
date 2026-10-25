import { useMemo } from "react";
import { toast } from "../../notifications/toast";
import { create } from "zustand";
import { TrashProjectEntry } from "../../../bridge/commands";
import { basename } from "../../path";
import { trashName } from "../../platform";

export const TRASH_UNDO_MS = 5000;

interface PendingTrash {
  id: number;
  root: string;
  path: string;
}

// Kept outside any one tab, so a move still lands, or is undone, after the
// Files tab that asked for it has closed.
const usePendingTrash = create<{ pending: PendingTrash[] }>(() => ({ pending: [] }));
let nextId = 0;

function settle(id: number) {
  usePendingTrash.setState((s) => ({ pending: s.pending.filter((p) => p.id !== id) }));
}

// Move to Trash, deferred: the row hides at once and the move waits out the
// Undo window, so undoing needs nothing back from the OS. `refresh` re-lists
// what showed the entry before the row stops hiding.
export function trashLater(root: string, path: string, refresh: () => Promise<void>): void {
  const id = ++nextId;
  const name = basename(path);
  usePendingTrash.setState((s) => ({ pending: [...s.pending, { id, root, path }] }));
  const timer = setTimeout(() => {
    void (async () => {
      try {
        await TrashProjectEntry(root, path);
        await refresh();
      } catch (err: unknown) {
        toast.error(`Couldn't move ${name} to the ${trashName()}: ${String(err)}`);
      }
      settle(id);
    })();
  }, TRASH_UNDO_MS);
  toast(`Moved ${name} to ${trashName()}`, {
    duration: TRASH_UNDO_MS,
    action: {
      label: "Undo",
      onClick: () => {
        clearTimeout(timer);
        settle(id);
      },
    },
  });
}

// The project-relative paths under `root` waiting out their Undo.
export function usePendingTrashPaths(root: string): readonly string[] {
  const pending = usePendingTrash((s) => s.pending);
  return useMemo(() => pending.filter((p) => p.root === root).map((p) => p.path), [pending, root]);
}
