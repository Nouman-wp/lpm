// The Telegram links the connect flow hands out. Each opens Telegram on the
// right screen, so the user taps once instead of following instructions.

// BotFather with /newbot already typed.
export const NEW_BOT_URL = "https://t.me/BotFather?text=%2Fnewbot";

// The bot's chat with its Start button, carrying lpm's code.
export function startUrl(bot: string, code: string): string {
  return `https://t.me/${bot}?start=${encodeURIComponent(code)}`;
}

// Telegram's "add to group" picker for the bot.
export function addToGroupUrl(bot: string, code: string): string {
  return `https://t.me/${bot}?startgroup=${encodeURIComponent(code)}`;
}

// Telegram's "add to channel" picker, asking only to post.
export function addToChannelUrl(bot: string): string {
  return `https://t.me/${bot}?startchannel&admin=post_messages`;
}

// The bot token inside whatever was pasted — BotFather's whole reply will do.
export function findBotToken(text: string): string | null {
  return /\d{5,}:[A-Za-z0-9_-]{30,}/.exec(text)?.[0] ?? null;
}
