import { Check, X } from "lucide-react";
import { useActionRunMarks } from "../store/actionRunMarks";

// The corner mark a quick action's button carries after a run: green when it
// passed, red when it failed.
export function ActionRunMarkBadge({ runKey }: { runKey: string }) {
  const mark = useActionRunMarks((s) => s.marks[runKey]);
  if (!mark) return null;
  return (
    <span
      role="img"
      aria-label={mark.ok ? "Last run passed" : "Last run failed"}
      className={`pointer-events-none absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white shadow-[0_0_0_2px_var(--bg-primary)] ${
        mark.ok ? "bg-[var(--accent-green)]" : "bg-[var(--accent-red)]"
      }`}
    >
      {mark.ok ? <Check size={9} strokeWidth={3.5} /> : <X size={9} strokeWidth={3.5} />}
    </span>
  );
}
