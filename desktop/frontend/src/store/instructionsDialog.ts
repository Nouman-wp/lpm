import { create } from "zustand";
import type { InstructionsTarget } from "../instructionSources";

export type InstructionsScope = "project" | "global";

export interface InstructionsDialogRequest {
  projectName: string;
  target: InstructionsTarget;
  scope: InstructionsScope;
  // The back button's tooltip, naming the dialog it returns to.
  backTitle: string;
}

interface InstructionsDialogState {
  request: InstructionsDialogRequest | null;
  // Bumped on every close, so what shows the instructions in effect reads them again.
  closedCount: number;
  show: (request: InstructionsDialogRequest) => void;
  close: () => void;
}

// The instructions editor opened from a commit, PR or branch dialog. It sits on
// top of that dialog instead of replacing it, so what was typed there survives.
export const useInstructionsDialog = create<InstructionsDialogState>((set) => ({
  request: null,
  closedCount: 0,
  show: (request) => set({ request }),
  close: () => set((s) => ({ request: null, closedCount: s.closedCount + 1 })),
}));
