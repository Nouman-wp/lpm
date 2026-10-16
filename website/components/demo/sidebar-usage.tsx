"use client";

import { FOCUS_RING } from "./ui";
import { sidebarUsageRows, type UsageSidebarSettings } from "./usage-data";
import { UsageLanes } from "./usage-lanes";

// Live plan usage in the sidebar footer: one line per agent CLI with when its
// window comes back, over a two-lane bar of how much of that window and the
// other one is gone.
export function SidebarUsage({
  settings,
  onOpen,
}: {
  settings: UsageSidebarSettings;
  onOpen: () => void;
}) {
  const rows = sidebarUsageRows(settings);
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 px-2 pb-0.5 pt-1">
      {rows.map((row) => {
        const summary = `${row.label} — ${row.percentText} of the ${row.windowLabel} window used, resets in ${row.detail}; ${row.laneText}`;
        return (
          <button
            key={row.key}
            type="button"
            onClick={onOpen}
            title={summary}
            aria-label={summary}
            className={`flex w-full flex-col gap-1 rounded-md px-3 py-1 text-left transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="min-w-[42px] max-w-[96px] shrink-0 truncate text-[11px] text-[#b3b3b3]">
                {row.label}
              </span>
              {row.windowShort && (
                <span className="ml-auto shrink-0 text-[10px] text-[#919191]">
                  {row.windowShort}
                </span>
              )}
              <span
                className={`${row.windowShort ? "" : "ml-auto "}min-w-0 truncate text-[10px] tabular-nums text-[#919191]`}
              >
                {row.detail}
              </span>
              <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-[#b3b3b3]">
                {row.percentText}
              </span>
            </span>
            <UsageLanes fraction={row.fraction} pace={row.pace} laneFraction={row.laneFraction} />
          </button>
        );
      })}
    </div>
  );
}
