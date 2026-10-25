import {
  RECAP_DEFAULT_THEME,
  RECAP_FONT,
  RECAP_GLOW_DEG,
  RECAP_HOURS_LABEL,
  RECAP_LAYOUT as L,
  RECAP_THEMES,
  RECAP_TITLE,
  type RecapTheme,
} from "./recapCardTheme";
import { RecapMark } from "./RecapMark";
import { mixText, type RecapView } from "./weeklyRecapModel";

const tileValue = { fontSize: 24, fontWeight: 800, lineHeight: `${L.tileValueLine}px` } as const;

/** "My week in lpm", sized to share: exactly the image it copies, with
 *  nothing on it that names a project. */
export function WeeklyRecapCard({
  view,
  theme = RECAP_DEFAULT_THEME,
}: {
  view: RecapView;
  theme?: RecapTheme;
}) {
  const C = RECAP_THEMES[theme];
  const row = { fontSize: L.rowSize, lineHeight: `${L.rowLine}px`, color: C.soft };
  const tileBox = {
    border: `1px solid ${C.border}`,
    borderRadius: L.tileRadius,
    background: C.tile,
    padding: `${L.tilePadY}px ${L.tilePadX}px`,
  };
  const tileLabel = { fontSize: 13, lineHeight: `${L.tileLabelLine}px`, color: C.muted };
  const columns = view.tiles.length + (view.lines ? 1 : 0);

  return (
    <div
      className="flex flex-col select-text"
      style={{
        width: L.width,
        boxSizing: "border-box",
        gap: L.gap,
        padding: `${L.padTop}px ${L.padX}px ${L.padBottom}px`,
        border: `1px solid ${C.border}`,
        borderRadius: L.radius,
        background: `linear-gradient(${RECAP_GLOW_DEG}deg, ${C.glow} 0%, ${C.ground} 55%)`,
        color: C.text,
        fontFamily: RECAP_FONT,
        fontSize: L.bodySize,
      }}
    >
      <div className="flex items-center gap-2" style={{ lineHeight: `${L.headerLine}px` }}>
        <span style={{ fontSize: L.titleSize, fontWeight: 700 }}>{RECAP_TITLE}</span>
        <span className="ml-auto" style={{ color: C.muted }}>
          {view.range}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3">
        <span
          style={{
            fontSize: L.heroSize,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: `${L.heroTracking}em`,
            color: C.strong,
          }}
        >
          {view.hours}
        </span>
        <span style={{ color: C.soft }}>{RECAP_HOURS_LABEL}</span>
        {view.gain && <span style={{ color: C.green, fontWeight: 600 }}>{view.gain}</span>}
      </div>

      {columns > 0 && (
        <div
          className="grid"
          style={{ gap: L.tileGap, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {view.tiles.map((tile) => (
            <div key={tile.id} className="flex flex-col" style={tileBox}>
              <span className="tabular-nums" style={{ ...tileValue, color: C.strong }}>
                {tile.value}
              </span>
              <span style={tileLabel}>{tile.label}</span>
            </div>
          ))}
          {view.lines && (
            <div className="flex flex-col" style={tileBox}>
              <span className="tabular-nums" style={{ ...tileValue, fontSize: 20, color: C.green }}>
                {view.lines.added}
              </span>
              <span style={tileLabel}>
                <span style={{ color: C.red }}>{view.lines.removed}</span> lines
              </span>
            </div>
          )}
        </div>
      )}

      {view.mix.length > 0 && (
        <div className="truncate" style={row}>
          {mixText(view.mix)}
        </div>
      )}

      <div className="flex items-center justify-end" style={{ height: L.footerLine }}>
        <RecapMark colors={C} />
      </div>
    </div>
  );
}
