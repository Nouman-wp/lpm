import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "../../notifications/toast";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <button
      type="button"
      aria-label="Copy code"
      title={copied ? "Copied" : "Copy code"}
      onClick={() => void copy()}
      className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
    >
      {copied ? <Check size={14} className="text-[var(--accent-green)]" /> : <Copy size={14} />}
    </button>
  );
}
