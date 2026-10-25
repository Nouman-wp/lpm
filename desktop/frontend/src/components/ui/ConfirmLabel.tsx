import type { ReactNode } from "react";
import { Check } from "lucide-react";

// Both labels share one grid cell, so the button is always as wide as the wider
// of the two and nothing beside it moves when they swap.
export function ConfirmLabel({
  confirmed,
  label,
  done,
}: {
  confirmed: boolean;
  label: ReactNode;
  done: ReactNode;
}) {
  return (
    <span className="inline-grid">
      <span aria-hidden={confirmed} className="col-start-1 row-start-1 aria-hidden:invisible">
        {label}
      </span>
      <span
        aria-hidden={!confirmed}
        className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1 aria-hidden:invisible"
      >
        <Check size={12} />
        {done}
      </span>
    </span>
  );
}
