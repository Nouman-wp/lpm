import { Pause } from "lucide-react";

interface JobOffBannerProps {
  onTurnOn: () => void;
}

// Why an automation that's off has nothing new, next to the way back on.
export function JobOffBanner({ onTurnOn }: JobOffBannerProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] leading-snug text-[var(--text-secondary)]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--bg-active)]">
        <Pause size={11} fill="currentColor" strokeWidth={0} />
      </span>
      <p className="min-w-0 flex-[1_1_240px]">
        <span className="font-semibold text-[var(--text-primary)]">This automation is off.</span>{" "}
        It won't run until you turn it on.
      </p>
      <button
        type="button"
        onClick={onTurnOn}
        className="shrink-0 rounded-lg bg-[var(--bg-active)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--text-primary)_10%,var(--bg-active))]"
      >
        Turn on
      </button>
    </div>
  );
}
