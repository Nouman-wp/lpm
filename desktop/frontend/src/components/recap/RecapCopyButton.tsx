import { useEffect, useState } from "react";
import { Check, Image as ImageIcon } from "lucide-react";
import { toast } from "../../notifications/toast";
import { copyRecapImage } from "./recapShare";
import type { RecapView } from "./weeklyRecapModel";

const COPIED_FOR = 2000;

export function RecapCopyButton({ view }: { view: RecapView }) {
  const [state, setState] = useState<"idle" | "copying" | "copied">("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), COPIED_FOR);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = () => {
    setState("copying");
    copyRecapImage(view)
      .then(() => setState("copied"))
      .catch((error) => {
        setState("idle");
        toast.error(`Couldn't copy the image: ${String(error)}`);
      });
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={state === "copying"}
      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] disabled:opacity-60"
    >
      {state === "copied" ? <Check size={13} strokeWidth={2.25} /> : <ImageIcon size={13} />}
      {state === "copied" ? "Copied" : "Copy as image"}
    </button>
  );
}
