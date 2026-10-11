import type { ReactNode } from "react";
import type { SendToTarget } from "../sendTo";

const KIND_LABEL: Record<string, string> = {
  private: "Private chat",
  group: "Group",
  supergroup: "Group",
  channel: "Channel",
};

// The chats Telegram can post in, each with what kind of chat it is and any
// actions the caller gives it. The first one is where plain "Telegram" goes.
export function TelegramChatList({
  chats,
  actions,
  fresh = [],
}: {
  chats: SendToTarget[];
  actions?: (chat: SendToTarget) => ReactNode;
  // Keys of chats that just turned up, marked so the user sees what changed.
  fresh?: string[];
}) {
  if (chats.length === 0) return null;
  return (
    <ul className="divide-y divide-[var(--border)]/70 overflow-hidden rounded-xl border border-[var(--border)]/70 bg-[var(--bg-secondary)]/40">
      {chats.map((chat, i) => (
        <li key={chat.key} className="flex items-center justify-between gap-3 px-3.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] text-[var(--text-primary)]">
              {chat.name}
              {fresh.includes(chat.key) && (
                <span className="ml-2 text-[11px] font-medium text-[var(--accent-cyan-text)]">
                  Just added
                </span>
              )}
            </p>
            <p className="text-[11.5px] text-[var(--text-muted)]">
              {KIND_LABEL[chat.kind ?? ""] ?? "Chat"}
              {i === 0 && chats.length > 1 ? " · default" : ""}
            </p>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions(chat)}</div>}
        </li>
      ))}
    </ul>
  );
}
