import { Check, Copy } from "lucide-react";
import { SetClipboardText } from "../../bridge/commands";
import { useConfirmFlash } from "../hooks/useConfirmFlash";

export function ToastCopyButton({ text, label = "Copy error" }: { text: string; label?: string }) {
  const [copied, flashCopied] = useConfirmFlash();

  const copy = async () => {
    await SetClipboardText(text);
    flashCopied();
  };

  return (
    <button type="button" className="toast-button" onClick={() => void copy()}>
      {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}
