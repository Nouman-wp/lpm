import { RECAP_COLORS } from "./recapCardTheme";
import { MARK_DOT, MARK_RINGS, MARK_VIEWBOX } from "./recapMarkShape";

/** lpm's mark and address, the card's signature. */
export function RecapMark() {
  return (
    <span className="inline-flex items-center gap-2" style={{ color: RECAP_COLORS.muted, fontSize: 14 }}>
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 29,
          height: 29,
          borderRadius: 7,
          background: RECAP_COLORS.markGround,
          border: `1px solid ${RECAP_COLORS.markBorder}`,
          boxSizing: "border-box",
        }}
      >
        <svg width={17} height={17} viewBox={MARK_VIEWBOX} aria-hidden="true">
          <circle cx={MARK_DOT.x} cy={MARK_DOT.y} r={MARK_DOT.r} fill={RECAP_COLORS.markDot} />
          {MARK_RINGS.map((ring) => (
            <circle
              key={ring.x}
              cx={ring.x}
              cy={ring.y}
              r={ring.r}
              fill="none"
              stroke={RECAP_COLORS.markRing}
              strokeWidth={ring.stroke}
            />
          ))}
        </svg>
      </span>
      lpm.cx
    </span>
  );
}
