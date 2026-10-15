import type { UsageLane } from "../sidebarUsage";
import { PaceTick } from "./PaceTick";

const TRACK =
  "linear-gradient(to bottom, var(--bg-active) 0 3px, transparent 3px 4px, var(--bg-active) 4px 5px)";

function width(fraction: number): string {
  return `${fraction > 0 ? Math.max(2, Math.round(fraction * 100)) : 0}%`;
}

/** Both limit windows on one track: the row's own window in the bolder upper
 *  lane, the other in a hairline lane under it. Only the upper lane draws a
 *  pace tick, pointing up out of the track. */
export function UsageLanes({
  upper,
  pace,
  lower,
  dim = false,
}: {
  upper: UsageLane;
  pace: number | null;
  lower: UsageLane;
  dim?: boolean;
}) {
  const opacity = dim ? 0.4 : 1;
  return (
    <span aria-hidden="true" className="relative block">
      <span className="relative block h-[5px] overflow-hidden rounded-[2.5px]" style={{ background: TRACK }}>
        <span
          className="absolute left-0 top-0 block h-[3px] rounded-r-[2px] transition-[width] duration-500"
          style={{ width: width(upper.fraction), backgroundColor: upper.fill, opacity }}
        />
        <span
          className="absolute bottom-0 left-0 block h-px transition-[width] duration-500"
          style={{ width: width(lower.fraction), backgroundColor: lower.fill, opacity }}
        />
      </span>
      {pace !== null && <PaceTick at={pace} dim={dim} className="top-[-3px] bottom-[2px] w-0.5" />}
    </span>
  );
}
