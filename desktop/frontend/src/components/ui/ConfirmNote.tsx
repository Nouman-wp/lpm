import type { ReactNode } from "react";
import { Check } from "lucide-react";

export function ConfirmNote({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
      <Check size={14} className="text-[var(--accent-green)]" />
      {children}
    </span>
  );
}
