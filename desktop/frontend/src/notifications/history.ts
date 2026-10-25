import { create } from "zustand";
import type { ToastId, ToastModel } from "./types";

const MAX_ENTRIES = 200;

// Every toast lands here too, so news that left the corner can still be read,
// copied or acted on from the bell. Titles keep only their words.
export type NotificationEntry = Pick<
  ToastModel,
  "id" | "kind" | "details" | "quote" | "tag" | "event" | "actions" | "retry" | "count"
> & {
  title: string;
  description?: string;
  at: number;
  read: boolean;
};

export type NotificationRecord = Omit<NotificationEntry, "read">;

interface HistoryState {
  entries: NotificationEntry[];
  record: (entry: NotificationRecord) => void;
  remove: (id: ToastId) => void;
  markRead: (id: ToastId) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationHistory = create<HistoryState>((set) => ({
  entries: [],

  record: (entry) =>
    set(({ entries }) => {
      const rest = entries.filter((e) => e.id !== entry.id);
      return { entries: [{ ...entry, read: false }, ...rest].slice(0, MAX_ENTRIES) };
    }),

  remove: (id) => set(({ entries }) => ({ entries: entries.filter((e) => e.id !== id) })),

  markRead: (id) =>
    set(({ entries }) => ({
      entries: entries.map((e) => (e.id === id && !e.read ? { ...e, read: true } : e)),
    })),

  markAllRead: () =>
    set(({ entries }) => ({
      entries: entries.some((e) => !e.read) ? entries.map((e) => ({ ...e, read: true })) : entries,
    })),

  clear: () => set({ entries: [] }),
}));

type Matchable = Pick<NotificationEntry, "kind" | "event">;

export const isWaiting = (entry: Matchable) => entry.event === "agentWaiting";

export const isFailure = (entry: Matchable) => entry.kind === "error";

/** The count on the bell: failures and agents waiting on you, still unread. */
export function selectUnreadAttention(state: HistoryState): number {
  return state.entries.filter((e) => !e.read && (isFailure(e) || isWaiting(e))).length;
}
