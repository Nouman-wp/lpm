import type { RecapView } from "./weeklyRecapModel";

const BAR_HEIGHT = 30;

/** The week at a glance in Monday's toast: the hours, the counts people post,
 *  and a bar for each day's agent time. */
export function RecapToastPreview({ view }: { view: RecapView }) {
  const counts = view.tiles
    .filter((tile) => tile.id === "prompts")
    .map((tile) => `${tile.value} ${tile.label}`)
    .join(" · ");

  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[26px] font-extrabold leading-none tracking-tight tabular-nums">
          {view.hours}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">of agents working for you</span>
        {counts && <span className="text-[11px] text-[var(--text-secondary)]">{counts}</span>}
      </div>
      <div className="flex shrink-0 gap-1" aria-hidden>
        {view.days.map((day, i) => (
          <div key={i} className="flex w-3.5 flex-col items-center gap-1">
            <div className="flex w-full items-end" style={{ height: BAR_HEIGHT }}>
              <span
                className="w-full rounded-[3px]"
                style={{
                  height: day.on ? Math.max(3, day.level * BAR_HEIGHT) : 2,
                  background: day.on ? "var(--accent-green)" : "var(--border)",
                }}
              />
            </div>
            <span className="text-[9px] font-semibold text-[var(--text-muted)]">{day.letter}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
