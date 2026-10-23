import { MonitorSmartphone } from "lucide-react";

const CAPSULE =
  "flex items-center gap-1.5 rounded-full border border-gray-200/70 bg-white/85 px-3 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none";

const CAPSULE_BODY = (
  <>
    <MonitorSmartphone className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
    <span className="whitespace-nowrap text-[9px] font-medium text-gray-500 dark:text-gray-300">
      Paired
    </span>
    <span className="relative inline-flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
    </span>
  </>
);

// Two separate connectors on purpose: one base element with sm: overrides
// shifted the line over the Mac window. The hairline must touch both devices.
// On a phone the iPhone overlaps the Mac, so the capsule sits under the Mac
// with no line.
export function SyncLink({ animate }: { animate: boolean }) {
  return (
    <>
      <div className={`absolute left-1 top-[22rem] z-10 sm:hidden ${CAPSULE}`}>
        {CAPSULE_BODY}
      </div>
      <div className="relative z-10 hidden h-72 w-36 shrink-0 overflow-hidden sm:-ml-4 sm:block">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-300 dark:bg-[#3a3a3c]" />
        {animate && (
          <>
            <span className="absolute top-1/2 h-px w-10 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent to-emerald-400 [animation:pd-spine-right_2.4s_ease-in-out_infinite]" />
            <span className="absolute top-1/2 h-px w-10 -translate-y-1/2 rounded-full bg-gradient-to-l from-transparent to-emerald-400/70 [animation:pd-spine-left_2.4s_ease-in-out_infinite]" />
          </>
        )}
        <div
          className={`absolute left-1/2 top-1/2 z-10 -mt-2 -translate-x-1/2 -translate-y-full ${CAPSULE}`}
        >
          {CAPSULE_BODY}
        </div>
      </div>
    </>
  );
}
