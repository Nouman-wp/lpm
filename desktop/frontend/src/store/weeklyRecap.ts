import { create } from "zustand";
import type { RecapWeek } from "../components/recap/weeklyRecapModel";

interface WeeklyRecapState {
  open: boolean;
  week: RecapWeek;
  show: (week?: RecapWeek) => void;
  close: () => void;
}

export const useWeeklyRecapStore = create<WeeklyRecapState>((set) => ({
  open: false,
  week: "last",
  show: (week = "last") => set({ open: true, week }),
  close: () => set({ open: false }),
}));
