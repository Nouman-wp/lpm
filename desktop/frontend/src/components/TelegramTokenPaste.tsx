import { useState } from "react";
import { findBotToken } from "../telegramLinks";

// Where BotFather's reply goes. Anything holding a bot token will do; the
// moment one shows up lpm checks it, so there's no button to press.
export function TelegramTokenPaste({
  onToken,
  busy,
  autoFocus,
}: {
  onToken: (token: string) => void;
  busy: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [tried, setTried] = useState<string | null>(null);
  const token = findBotToken(text);
  const problem = text.trim() && !token ? "That doesn't look like BotFather's reply yet." : "";

  const change = (next: string) => {
    setText(next);
    const found = findBotToken(next);
    if (found && found !== tried) {
      setTried(found);
      onToken(found);
    }
  };

  return (
    <div className="space-y-1.5">
      <textarea
        rows={2}
        value={text}
        autoFocus={autoFocus}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        placeholder="Paste BotFather's reply here"
        aria-label="BotFather's reply"
        autoComplete="off"
        spellCheck={false}
        className="block w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)]/60 disabled:opacity-60"
      />
      <p className="min-h-[16px] text-[11.5px] text-[var(--text-muted)]">
        {busy ? "Checking the token with Telegram…" : problem}
      </p>
    </div>
  );
}
