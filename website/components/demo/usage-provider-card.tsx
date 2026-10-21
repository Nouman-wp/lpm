import type { UsageProviderData } from "./usage-data";
import { UsageMeter } from "./usage-meter";

// Ports the app's UsageProviderCard: one agent's plan, both windows and the
// day's spend. Stacked, it fits the popover beside a sidebar row.
export function UsageProviderCard({
  provider,
  stacked = false,
  fiveHourFirst = false,
}: {
  provider: UsageProviderData;
  stacked?: boolean;
  fiveHourFirst?: boolean;
}) {
  const fiveHour = { label: "5-hour", win: provider.fiveHour };
  const weekly = { label: "Weekly", win: provider.weekly };
  return (
    <section className="rounded-xl border border-[#2e2e2e] bg-[#242424] p-4">
      <header
        className={`flex items-center gap-2 border-b border-[#2e2e2e] pb-3 ${stacked ? "flex-wrap gap-y-1" : ""}`}
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: provider.color }}
        />
        <span className="shrink-0 text-sm font-medium text-[#e5e5e5]">{provider.label}</span>
        {provider.account && (
          <span
            className={`min-w-0 truncate text-[11px] text-[#919191] ${stacked ? "order-last basis-full pl-4" : ""}`}
          >
            {provider.account}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="rounded border border-[#2e2e2e] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#b3b3b3]">
            {provider.plan}
          </span>
          <span className="text-[11px] tabular-nums text-[#919191]">{provider.updated}</span>
        </span>
      </header>

      <div className={`grid gap-x-6 gap-y-5 pt-3.5 ${stacked ? "grid-cols-1" : "grid-cols-2"}`}>
        {(fiveHourFirst ? [fiveHour, weekly] : [weekly, fiveHour]).map((meter) => (
          <UsageMeter key={meter.label} label={meter.label} win={meter.win} />
        ))}
      </div>

      <div className="mt-3.5 border-t border-[#2e2e2e] pt-3 text-[11px] tabular-nums text-[#919191]">
        {provider.tokensToday} spent today · {provider.sessions} sessions
      </div>
    </section>
  );
}
