import { paceFill, USAGE_FILL } from "./usage-data";

const TRACK =
  "linear-gradient(to bottom, #333333 0 3px, transparent 3px 4px, #333333 4px 5px)";

function widthPercent(fraction: number): number {
  return fraction > 0 ? Math.max(2, Math.round(fraction * 100)) : 0;
}

/** Both limit windows on one track, the way the app's sidebar draws them: the
 *  row's own window in the bolder upper lane, the other in a hairline lane
 *  under it, and a pace tick standing up out of the track. */
export function UsageLanes({
  fraction,
  pace,
  laneFraction,
}: {
  fraction: number;
  pace: number;
  laneFraction: number;
}) {
  const upperWidth = widthPercent(fraction);
  return (
    <span aria-hidden="true" className="relative block">
      <span
        className="relative block h-[5px] overflow-hidden rounded-[2.5px]"
        style={{ background: TRACK }}
      >
        <span
          className="absolute left-0 top-0 block h-[3px] rounded-r-[2px] transition-[width] duration-500"
          style={{ width: `${upperWidth}%`, background: paceFill(upperWidth, pace * 100) }}
        />
        <span
          className="absolute bottom-0 left-0 block h-px transition-[width] duration-500"
          style={{ width: `${widthPercent(laneFraction)}%`, backgroundColor: USAGE_FILL }}
        />
      </span>
      <span
        className="absolute bottom-[2px] top-[-3px] w-0.5 -translate-x-1/2 rounded-full bg-[#e5e5e5]"
        style={{ left: `${pace * 100}%` }}
      />
    </span>
  );
}
