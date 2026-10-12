import { useCallback, type RefObject } from "react";
import { collectPanes, type PaneNode } from "../../paneTree";

// Focus the project's Automations tab wherever it lives in the layout, or add
// one to the focused pane. Waits for the mount restore first: a tab added to a
// project that just mounted would be replaced by the restored layout.
export function useOpenAutomationsTab(
  treeRef: RefObject<PaneNode | null>,
  restoreSettled: RefObject<Promise<void>>,
  focusTerminal: (paneId: string, tabIdx: number) => void,
  addAutomationsToPane: (paneId?: string) => void,
) {
  return useCallback(async () => {
    await restoreSettled.current;
    for (const pane of treeRef.current ? collectPanes(treeRef.current) : []) {
      const tabIdx = pane.tabs.findIndex((t) => t.kind === "automations");
      if (tabIdx >= 0) return focusTerminal(pane.id, tabIdx);
    }
    addAutomationsToPane();
  }, [treeRef, restoreSettled, focusTerminal, addAutomationsToPane]);
}
