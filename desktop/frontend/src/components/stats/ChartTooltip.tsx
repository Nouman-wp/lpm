import type { DailyUsage } from "../../types";
import { formatPercent, formatTokenCount } from "../../agentUsageFormat";
import { providerMeta } from "./statsDerive";
import { estimateDailyCost, formatUsd } from "./statsCost";
import type { ProviderFilter } from "./chartScale";

const PROVIDER_KEYS = ["claude", "codex"] as const;

interface ChartTooltipProps {
  bucket: DailyUsage;
  title: string;
  filter: ProviderFilter;
  centerFraction: number;
  reducedMotion: boolean;
}

export function ChartTooltip({
  bucket,
  title,
  filter,
  centerFraction,
  reducedMotion,
}: ChartTooltipProps) {
  const cost = estimateDailyCost(bucket.models);
  const flip = centerFraction > 0.62;

  return (
    <div
      className="pointer-events-none absolute top-2 z-10"
      style={{
        left: `${centerFraction * 100}%`,
        transform: flip ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
      }}
    >
      <div
        className="w-max rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 shadow-lg"
        style={{ animation: reducedMotion ? "none" : "statsTooltipIn 120ms ease-out" }}
      >
        <div className="text-xs font-semibold text-[var(--text-primary)]">{title}</div>
        <div className="mt-1.5 space-y-1">
          {PROVIDER_KEYS.filter((key) => filter[key]).map((key) => {
            const meta = providerMeta(key);
            const tokens = key === "claude" ? bucket.claudeTokens : bucket.codexTokens;
            const share = tokens / Math.max(1, bucket.totalTokens);
            return (
              <div key={key} className="flex items-center gap-2 text-[11px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-[var(--text-secondary)]">{meta.short}</span>
                <span className="ml-auto tabular-nums text-[var(--text-primary)]">
                  {formatTokenCount(tokens)}
                </span>
                {cost > 0 && (
                  <span className="w-16 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatUsd(estimateDailyCost(bucket.models, key))}
                  </span>
                )}
                <span className="w-9 text-right tabular-nums text-[var(--text-muted)]">
                  {formatPercent(share)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex items-center gap-2 border-t border-[var(--border)] pt-1.5 text-[11px]">
          <span className="text-[var(--text-muted)]">Total</span>
          <span className="ml-auto tabular-nums text-[var(--text-primary)]">
            {formatTokenCount(bucket.totalTokens)}
          </span>
          {cost > 0 && (
            <>
              <span className="w-16 text-right tabular-nums text-[var(--text-primary)]">
                <span className="text-[var(--text-muted)]">≈</span> {formatUsd(cost)}
              </span>
              <span className="w-9" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
