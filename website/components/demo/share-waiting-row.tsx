"use client";

import { PersonAvatar } from "./person-avatar";
import { FOCUS_RING, PRESS } from "./ui";
import type { ShareWaiting } from "./use-tab-shares";

// Ports the app's ShareWaitingRow: someone who opened the link, waiting to be
// let in.
export function ShareWaitingRow({
  waiting,
  onRespond,
}: {
  waiting: ShareWaiting;
  onRespond: (allow: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-[#facc15]/5 px-3 py-2.5">
      <PersonAvatar name={waiting.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[#e5e5e5]">
          {waiting.name}
          <span className="ml-1.5 text-[11px] font-normal text-[#919191]">wants to join</span>
        </div>
        <div title="They see these emoji too" className="mt-0.5 text-sm tracking-wider">
          {waiting.code}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRespond(false)}
        className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-[#b3b3b3] transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
      >
        Deny
      </button>
      <button
        type="button"
        onClick={() => onRespond(true)}
        className={`shrink-0 rounded-md bg-[#e5e5e5] px-2.5 py-1 text-[11px] font-medium text-[#1a1a1a] hover:opacity-90 ${PRESS} ${FOCUS_RING}`}
      >
        Let in
      </button>
    </div>
  );
}
