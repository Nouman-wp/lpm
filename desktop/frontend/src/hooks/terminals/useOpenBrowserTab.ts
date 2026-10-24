import { useCallback, type RefObject } from "react";
import { collectPanes, type PaneNode } from "../../paneTree";
import { projectAddress } from "../../peer/projectPorts";
import { useBrowserUrls } from "../../store/browserUrls";
import { urlOrigin } from "../../browserStartUrls";

// Show a page of one of the project's servers: focus the Browser tab already on
// that server, wherever it is in the layout, or open one at the page in `paneId`
// (the focused pane when that one is gone). Waits for the mount restore first,
// like the Automations tab: a tab added before it would be replaced.
export function useOpenBrowserTab(
  projectName: string,
  treeRef: RefObject<PaneNode | null>,
  restoreSettled: RefObject<Promise<void>>,
  focusTerminal: (paneId: string, tabIdx: number) => void,
  addBrowserToPane: (paneId?: string, url?: string, label?: string) => void,
) {
  return useCallback(
    async (url: string, label?: string, paneId?: string) => {
      await restoreSettled.current;
      // Open tabs hold the address this Mac reaches, a paired machine's through
      // its tunnel, so that is what they are matched on.
      const local = await projectAddress(projectName, url).catch(() => url);
      const origin = urlOrigin(local);
      const urls = useBrowserUrls.getState().urls;
      const panes = treeRef.current ? collectPanes(treeRef.current) : [];
      for (const pane of panes) {
        const tabIdx = pane.tabs.findIndex(
          (t) => t.kind === "browser" && origin !== null && urlOrigin(urls[t.id] ?? "") === origin,
        );
        if (tabIdx >= 0) return focusTerminal(pane.id, tabIdx);
      }
      addBrowserToPane(panes.some((p) => p.id === paneId) ? paneId : undefined, url, label);
    },
    [projectName, treeRef, restoreSettled, focusTerminal, addBrowserToPane],
  );
}
