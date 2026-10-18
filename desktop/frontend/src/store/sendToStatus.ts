import { create } from "zustand";
import { machineCommands } from "../components/settings/machineCommands";
import type { SendToLinks, SendToTarget } from "../sendTo";

export interface TelegramLink {
  connected: boolean;
  hasToken: boolean;
  bot?: string | null;
  // What lpm's Start links carry, so a chat tapping Start is known to be yours.
  code?: string | null;
  chats: SendToTarget[];
}

// How each outside destination is linked, on each machine: a job sends its
// results from the machine it runs on. `host` is a connected machine's slug, or
// null for this one. Shared so a link made in one place — Settings, or the job
// editor's connect dialog — shows in the other.
export interface SendToStatusState {
  telegram: Record<string, TelegramLink>;
  refresh: (host: string | null) => Promise<void>;
}

const machineKey = (host: string | null) => host ?? "";

export const useSendToStatus = create<SendToStatusState>((set) => ({
  telegram: {},
  refresh: async (host) => {
    let link: TelegramLink;
    try {
      const s = await machineCommands(host).telegram.status();
      link = { ...s, chats: Array.isArray(s?.chats) ? s.chats : [] };
    } catch {
      link = { connected: false, hasToken: false, chats: [] };
    }
    set((state) => ({ telegram: { ...state.telegram, [machineKey(host)]: link } }));
  },
}));

export function telegramLinkOf(state: SendToStatusState, host: string | null): TelegramLink | undefined {
  return state.telegram[machineKey(host)];
}

// Each service's link on a machine, as the destination helpers in sendTo.ts read it.
export function sendToLinks(telegram: TelegramLink | undefined): SendToLinks {
  return { telegram: telegram && { connected: telegram.connected, targets: telegram.chats } };
}
