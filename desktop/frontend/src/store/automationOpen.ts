import { create } from "zustand";

// `lpm automations open` asks an Automations view to open one automation. The
// view may still be mounting when the request lands, so it waits here until the
// view has its list and clears it.
export interface AutomationOpenRequest {
  id: string;
  // The project whose runs to show; null opens a global.yml automation the way
  // its own row does.
  project: string | null;
  // The view that opens it: that project's Automations tab, or null for the
  // app-wide page.
  host: string | null;
}

interface AutomationOpenState {
  request: AutomationOpenRequest | null;
  open: (request: AutomationOpenRequest) => void;
  clear: () => void;
}

export const useAutomationOpen = create<AutomationOpenState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  clear: () => set({ request: null }),
}));
