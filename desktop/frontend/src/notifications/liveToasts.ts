import { create } from "zustand";
import type { ToastId, ToastModel } from "./types";

// The toasts on screen right now, newest last. Cards read their own model from
// here, so an update repaints in place instead of stacking a new toast.
interface LiveToastsState {
  toasts: ToastModel[];
  put: (model: ToastModel) => void;
  drop: (id: ToastId) => void;
}

export const useLiveToasts = create<LiveToastsState>((set) => ({
  toasts: [],

  put: (model) =>
    set(({ toasts }) => {
      const at = toasts.findIndex((t) => t.id === model.id);
      if (at === -1) return { toasts: [...toasts, model] };
      const next = [...toasts];
      next[at] = model;
      return { toasts: next };
    }),

  drop: (id) => set(({ toasts }) => ({ toasts: toasts.filter((t) => t.id !== id) })),
}));

export function findLiveToast(id: ToastId): ToastModel | undefined {
  return useLiveToasts.getState().toasts.find((t) => t.id === id);
}
