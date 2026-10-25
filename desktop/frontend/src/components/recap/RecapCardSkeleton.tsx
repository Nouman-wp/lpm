import { RECAP_COLORS as C, RECAP_LAYOUT as L } from "./recapCardTheme";

export function RecapCardSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      style={{
        width: L.width,
        height: 431,
        borderRadius: L.radius,
        border: `1px solid ${C.border}`,
        background: C.ground,
        color: C.muted,
        fontSize: 13,
      }}
    >
      <span className="h-2 w-40 animate-pulse rounded-full" style={{ background: C.border }} />
      {label}
    </div>
  );
}
