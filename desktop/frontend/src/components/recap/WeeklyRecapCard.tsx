import {
  RECAP_COLORS as C,
  RECAP_FONT,
  RECAP_GLOW_DEG,
  RECAP_LAYOUT as L,
  RECAP_TAGLINE,
} from "./recapCardTheme";
import { RecapMark } from "./RecapMark";
import { mixText, type RecapView } from "./weeklyRecapModel";

const row = { fontSize: L.rowSize, lineHeight: `${L.rowLine}px`, color: C.soft } as const;
const tileBox = {
  border: `1px solid ${C.border}`,
  borderRadius: L.tileRadius,
  background: C.tile,
  padding: `${L.tilePadY}px ${L.tilePadX}px`,
} as const;
const tileValue = { fontSize: 24, fontWeight: 800, lineHeight: `${L.tileValueLine}px` } as const;
const tileLabel = { fontSize: 13, lineHeight: `${L.tileLabelLine}px`, color: C.muted } as const;

/** "Your week in lpm", sized to share: exactly the image it copies, with
 *  nothing on it that names a project. */
export function WeeklyRecapCard({ view }: { view: RecapView }) {
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
        <span style={{ fontSize: L.titleSize, fontWeight: 700 }}>Your week in lpm</span>
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
        <span style={{ color: C.soft }}>of agents working for you</span>
        {view.gain && <span style={{ color: C.green, fontWeight: 600 }}>{view.gain}</span>}
      </div>

      <div className="grid grid-cols-3" style={{ gap: L.tileGap }}>
        {view.tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col" style={tileBox}>
            <span className="tabular-nums" style={{ ...tileValue, color: C.strong }}>
              {tile.value}
            </span>
            <span style={tileLabel}>{tile.label}</span>
          </div>
        ))}
        <div className="flex flex-col" style={tileBox}>
          <span className="tabular-nums" style={{ ...tileValue, fontSize: 20, color: C.green }}>
            {view.linesAdded}
          </span>
          <span style={tileLabel}>
            <span style={{ color: C.red }}>{view.linesRemoved}</span> lines
          </span>
        </div>
      </div>

      {view.mix.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between gap-3" style={row}>
            <span className="shrink-0">Agents</span>
            <span className="min-w-0 truncate">{mixText(view.mix)}</span>
          </div>
          <div
            className="flex overflow-hidden"
            style={{ gap: L.barGap, height: L.barHeight, borderRadius: 5 }}
          >
            {view.mix.map((slice) => (
              <span
                key={slice.label}
                style={{ flex: `${slice.percent} 1 0`, background: slice.color, minWidth: 3 }}
              />
            ))}
          </div>
        </div>
      )}

      {view.projects && (
        <div className="flex justify-between gap-3" style={row}>
          <span className="shrink-0">Projects</span>
          <span className="min-w-0 truncate">{view.projects}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span style={row}>{view.streak}</span>
        <div className="flex" style={{ gap: L.dayGap }}>
          {view.days.map((day, i) => (
            <span
              key={i}
              className="flex items-center justify-center"
              style={{
                width: L.day,
                height: L.day,
                boxSizing: "border-box",
                borderRadius: L.dayRadius,
                fontSize: 12,
                fontWeight: 700,
                background: day.on ? C.green : "transparent",
                color: day.on ? C.onGreen : C.muted,
                border: `1px solid ${day.on ? C.green : C.dayOff}`,
              }}
            >
              {day.letter}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4" style={{ height: L.footerLine }}>
        <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13, color: C.muted }}>
          {RECAP_TAGLINE}
        </span>
        <RecapMark />
      </div>
    </div>
  );
}
