import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { SetClipboardText } from "../../../bridge/commands";

// Over the last screen of a shared tab that ended, which stays readable until
// it's removed.
export function SharedTabEndedCard({
  title,
  onCopy,
  onRemove,
}: {
  title: string;
  onCopy: () => string;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="absolute inset-x-4 bottom-4 rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4 shadow-2xl">
      <div className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</div>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
        The last screen stays here until you remove it.
      </p>
      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void SetClipboardText(onCopy()).then(() => setCopied(true));
          }}
          className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy output"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="h-[34px] flex-1 rounded-lg bg-[var(--text-primary)] text-[13px] font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
