"use client";

import { Users } from "lucide-react";
import { SharePersonRow } from "./share-person-row";
import { ShareWaitingRow } from "./share-waiting-row";
import { FOCUS_RING } from "./ui";
import { anyoneTypes, type TabShare } from "./use-tab-shares";

// Ports the app's SharePeople: who is waiting, who is in, and what each may do.
export function SharePeople({
  share,
  onRespond,
  onSetGuestCanType,
  onRemoveGuest,
  onTakeKeyboards,
}: {
  share: TabShare;
  onRespond: (id: string, allow: boolean) => void;
  onSetGuestCanType: (id: string, canType: boolean) => void;
  onRemoveGuest: (id: string) => void;
  onTakeKeyboards: () => void;
}) {
  if (share.waiting.length === 0 && share.guests.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-[#2e2e2e] p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#242424] text-[#919191]">
          <Users size={15} />
        </span>
        <p className="text-xs leading-[1.45] text-[#b3b3b3]">
          No one yet. When someone opens the link, you&apos;ll be asked before they get in.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#919191]">People</span>
        {anyoneTypes(share) && (
          <button
            type="button"
            onClick={onTakeKeyboards}
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#fbbf24] transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
          >
            Take every keyboard back
          </button>
        )}
      </div>
      <div className="mt-2 divide-y divide-[#2e2e2e] overflow-hidden rounded-[10px] border border-[#2e2e2e]">
        {share.waiting.map((w) => (
          <ShareWaitingRow key={w.id} waiting={w} onRespond={(allow) => onRespond(w.id, allow)} />
        ))}
        {share.guests.map((g) => (
          <SharePersonRow
            key={g.id}
            guest={g}
            onSetCanType={(canType) => onSetGuestCanType(g.id, canType)}
            onRemove={() => onRemoveGuest(g.id)}
          />
        ))}
      </div>
    </div>
  );
}
