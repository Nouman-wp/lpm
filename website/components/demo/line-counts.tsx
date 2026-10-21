// Ports the app's LineCounts: "+12 −3" in the diff colors, each half only when
// it has lines.
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
      {added > 0 && <span className="text-[#4ade80]">+{added}</span>}
      {removed > 0 && <span className="text-[#f87171]">−{removed}</span>}
    </span>
  );
}
