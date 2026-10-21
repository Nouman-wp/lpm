import { MousePointer2 } from "lucide-react";
import type { TourHint } from "./tour";

// Clear of the app's header and tab strip: for the seconds it is up the pill
// would otherwise sit on the split-layout buttons and the tabs its own line is
// telling the visitor to use.
export function DemoHintPill({
  hint,
  hidden,
}: {
  hint: TourHint;
  hidden: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={hidden}
      className={`pointer-events-none absolute right-3 top-20 z-30 max-w-[260px] transition-all duration-500 ${
        hidden ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="flex items-start gap-2 rounded-2xl border border-white/15 bg-black/75 px-3.5 py-1.5 text-[11px] sm:text-[12px] font-medium leading-snug text-[#e5e5e5] shadow-2xl backdrop-blur-md">
        <MousePointer2
          className="h-3.5 w-3.5 text-[#60a5fa] shrink-0"
          strokeWidth={2.25}
        />
        <span className="sm:hidden">{hint.short}</span>
        <span className="hidden sm:inline">{hint.long}</span>
      </div>
    </div>
  );
}
