import { Check } from "lucide-react";
import { signedInLine, type ClaudeLoginStatus } from "../claudeLoginStatus";
import { Spinner } from "./settings/Spinner";

export function ClaudeLoginStatusStrip({ status }: { status: ClaudeLoginStatus }) {
  const accent = status.signedIn ? "green" : "blue";
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, var(--accent-${accent}) 9%, transparent)`,
        color: `var(--accent-${accent}-text)`,
      }}
    >
      {status.signedIn ? <Check size={14} strokeWidth={2.25} /> : <Spinner size={12} />}
      <span className="min-w-0 truncate">{status.signedIn ? signedInLine(status) : "Waiting for the browser…"}</span>
    </div>
  );
}
