import { create } from "zustand";

// `lpm automations open` asks the Automations page to open one automation. The
// page may still be mounting when the request lands, so it waits here until the
// page has its list and clears it.
export interface AutomationOpenRequest {
  id: string;
  // The project whose runs to show; null opens a global.yml automation the way
  // its own row does.
  project: string | null;
}

interface AutomationOpenState {
  request: AutomationOpenRequest | null;
  open: (id: string, project: string | null) => void;
  clear: () => void;
}

export const useAutomationOpen = create<AutomationOpenState>((set) => ({
  request: null,
  open: (id, project) => set({ request: { id, project } }),
  clear: () => set({ request: null }),
}));
