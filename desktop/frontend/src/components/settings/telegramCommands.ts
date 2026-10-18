import {
  TelegramConnect,
  TelegramDisconnect,
  TelegramFindChats,
  TelegramRemoveChat,
  TelegramStatus,
  TelegramTest,
} from "../../../bridge/commands";
import type { MachineRun } from "./machineCommands";

// The Telegram bot a machine posts automation results through (telegram.rs).
export interface TelegramCommands {
  status: () => Promise<any>;
  // `text` is the bot's token, or anything holding it.
  connect: (text: string) => Promise<void>;
  findChats: () => Promise<any>;
  test: (key?: string) => Promise<void>;
  removeChat: (key: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const LOCAL_TELEGRAM: TelegramCommands = {
  status: () => TelegramStatus(),
  connect: (text) => TelegramConnect(text),
  findChats: () => TelegramFindChats(),
  test: (key) => TelegramTest(key),
  removeChat: (key) => TelegramRemoveChat(key),
  disconnect: () => TelegramDisconnect(),
};

export function peerTelegram(run: MachineRun): TelegramCommands {
  return {
    status: () => run("telegram_status"),
    connect: (token) => run("telegram_connect", { token }),
    findChats: () => run("telegram_find_chats"),
    test: (key) => run("telegram_test", { key: key ?? null }),
    removeChat: (key) => run("telegram_remove_chat", { key }),
    disconnect: () => run("telegram_disconnect"),
  };
}
