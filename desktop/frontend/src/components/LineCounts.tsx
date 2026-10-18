import { compactCount } from "../compactCount";

// "+400 −100": the lines a change adds and removes, a zero side left out.
export function LineCounts({
  added,
  removed,
  className = "",
}: {
  added: number;
  removed: number;
  className?: string;
}) {
  if (added + removed === 0) return null;
  return (
    <span className={`flex items-center gap-1 tabular-nums ${className}`}>
      {added > 0 && (
        <span className="text-[var(--accent-green-text)]">+{compactCount(added)}</span>
      )}
      {removed > 0 && (
        <span className="text-[var(--accent-red-text)]">−{compactCount(removed)}</span>
      )}
    </span>
  );
}
