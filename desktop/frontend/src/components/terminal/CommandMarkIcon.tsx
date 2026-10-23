import { Check, X } from "lucide-react";
import type { TabCommandMark } from "../../tabCommand";

// After the tab's name: a dot while a command runs, then how it ended. The dot
// holds still, since a dev server can run in a tab all day.
export function CommandMarkIcon({ mark }: { mark: TabCommandMark | null }) {
  if (mark === "running") {
    return (
      <span
        role="img"
        aria-label="Running a command"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-cyan)]"
      />
    );
  }
  if (mark === "passed") {
    return <Check size={11} strokeWidth={2.5} aria-label="Last command passed" className="shrink-0 text-[var(--accent-green)]" />;
  }
  if (mark === "failed") {
    return <X size={11} strokeWidth={2.5} aria-label="Last command failed" className="shrink-0 text-[var(--accent-red)]" />;
  }
  return null;
}
