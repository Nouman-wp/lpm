"use client";

import { Users } from "lucide-react";
import { Tooltip } from "./tooltip";
import { anyoneTypes, shareTint, type TabShare } from "./use-tab-shares";

// Ports the app's SharedTabMark: a shared tab is never shared without showing
// it, and says when someone is waiting to be let in.
export function SharedTabMark({ share }: { share: TabShare }) {
  const watching = share.guests.length;
  const waiting = share.waiting.length;
  const who =
    watching === 0
      ? "No one is watching"
      : `${watching} ${watching === 1 ? "person is" : "people are"} watching`;
  return (
    <Tooltip
      content={`Shared · ${who}${anyoneTypes(share) ? " · some can type" : ""}${waiting ? ` · ${waiting} waiting` : ""}`}
      side="bottom"
      triggerClassName="inline-flex shrink-0"
    >
      <span className="flex items-center gap-1">
        <span className={`flex items-center gap-0.5 ${shareTint(share)}`}>
          <Users size={11} />
          {watching > 0 && <span className="text-[10px] tabular-nums">{watching}</span>}
        </span>
        {waiting > 0 && (
          <span className="flex h-4 items-center gap-1 rounded-full bg-[#fbbf24]/15 px-1.5 text-[10px] font-semibold tabular-nums text-[#fbbf24]">
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#fbbf24]" />
            {waiting}
          </span>
        )}
      </span>
    </Tooltip>
  );
}
