import { create } from "zustand";

export type UpdatePhase = "checking" | "downloading" | "installing";

/** An install `lpm update` asked for, waiting until nothing is busy. */
export interface ScheduledUpdate {
  version: string;
  /** What it waits for: "2 agents in lpm; 1 action in api". */
  waiting: string;
}

export interface UpdateInstallState {
  active: boolean;
  phase: UpdatePhase;
  progress: number;
  cancelling: boolean;
  error: string;
  scheduled: ScheduledUpdate | null;
}

export const IDLE_UPDATE_INSTALL: UpdateInstallState = {
  active: false,
  phase: "checking",
  progress: -1,
  cancelling: false,
  error: "",
  scheduled: null,
};

// Shared so the sidebar row and Settings show the same install, whichever
// one started it.
export const useUpdateInstallState = create<UpdateInstallState>(() => IDLE_UPDATE_INSTALL);
