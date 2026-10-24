import { create } from "zustand";
import { useAppStore } from "./app";

// A page to show in a project's own Browser tab, asked for from outside its
// terminal view (a port link, the sidebar menu). The project comes on screen and
// its mounted detail opens the page, reusing a tab already on that server.
export interface BrowserRequest {
  projectName: string;
  url: string;
  label?: string;
  // The pane a new tab opens in: the one the link was clicked in.
  paneId?: string;
  nonce: number;
}

interface BrowserRequestState {
  request: BrowserRequest | null;
}

let nonce = 0;

export const useBrowserRequest = create<BrowserRequestState>(() => ({ request: null }));

export function requestProjectBrowser(
  projectName: string,
  url: string,
  opts: { label?: string; paneId?: string } = {},
): void {
  const app = useAppStore.getState();
  app.selectProject(projectName);
  app.markVisited(projectName);
  useBrowserRequest.setState({ request: { projectName, url, ...opts, nonce: ++nonce } });
}

export function clearBrowserRequest(): void {
  useBrowserRequest.setState({ request: null });
}
