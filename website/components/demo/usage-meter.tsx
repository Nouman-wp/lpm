import {
  resetAbsolute,
  resetDurationShort,
  usageBarColor,
  usagePaceColor,
  usagePaceLabel,
  type UsageWindowData,
} from "./usage-data";

// One window's meter on a usage card: how much is used, the pace against the
// clock, and when it resets.
export function UsageMeter({ label, win }: { label: string; win: UsageWindowData }) {
  const pace = usagePaceLabel(win);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.13em] text-[#919191]">
        {label}
      </span>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-2xl font-semibold leading-none tabular-nums tracking-tight text-[#e5e5e5]">
          {Math.round(win.usedPercent)}
        </span>
        <span className="text-[12px] leading-none text-[#919191]">%</span>
        {pace && <span className={`text-[11px] leading-none ${usagePaceColor(pace)}`}>{pace}</span>}
      </div>
      <div
        role="meter"
        aria-label={`${label} window usage`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(win.usedPercent)}
        title={`${Math.round(win.elapsedPercent)}% of the window has elapsed`}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#333333]"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${Math.max(1, Math.min(100, win.usedPercent))}%`,
            backgroundColor: usageBarColor(win.usedPercent),
          }}
        />
        {win.elapsedPercent >= 5 && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-px -translate-x-1/2 bg-[#b3b3b3] opacity-70"
            style={{ left: `${win.elapsedPercent}%` }}
          />
        )}
      </div>
      <span className="truncate text-[11px] tabular-nums text-[#919191]">
        resets in {resetDurationShort(win.resetInMs)} ·{" "}
        {resetAbsolute(win.resetInMs)}
      </span>
    </div>
  );
}
