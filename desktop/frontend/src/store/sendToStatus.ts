import { create } from "zustand";
import { TelegramStatus } from "../../bridge/commands";
import type { SendToLinks, SendToTarget } from "../sendTo";

export interface TelegramLink {
  connected: boolean;
  hasToken: boolean;
  bot?: string | null;
  // What lpm's Start links carry, so a chat tapping Start is known to be yours.
  code?: string | null;
  chats: SendToTarget[];
}

// How each outside destination is linked. Shared so a link made in one place —
// Settings, or the job editor's connect dialog — shows in the other.
export interface SendToStatusState {
  telegram?: TelegramLink;
  refresh: () => Promise<void>;
}

export const useSendToStatus = create<SendToStatusState>((set) => ({
  telegram: undefined,
  refresh: async () => {
    try {
      const s = await TelegramStatus();
      set({ telegram: { ...s, chats: Array.isArray(s?.chats) ? s.chats : [] } });
    } catch {
      set({ telegram: { connected: false, hasToken: false, chats: [] } });
    }
  },
}));

// Each service's link as the destination helpers in sendTo.ts read it.
export function sendToLinks(state: SendToStatusState): SendToLinks {
  const t = state.telegram;
  return { telegram: t && { connected: t.connected, targets: t.chats } };
}
