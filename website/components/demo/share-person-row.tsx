"use client";

import { Globe, Laptop, X } from "lucide-react";
import { PersonAvatar } from "./person-avatar";
import { Tooltip } from "./tooltip";
import { FOCUS_RING } from "./ui";
import { Switch } from "./ui-kit/switch";
import type { ShareGuest } from "./use-tab-shares";

// Ports the app's SharePersonRow: someone let in, what they may do, and the
// way to remove them.
export function SharePersonRow({
  guest,
  onSetCanType,
  onRemove,
}: {
  guest: ShareGuest;
  onSetCanType: (canType: boolean) => void;
  onRemove: () => void;
}) {
  const Source = guest.via === "browser" ? Globe : Laptop;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <PersonAvatar name={guest.name} live />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[#e5e5e5]">{guest.name}</div>
        <div className="mt-px flex items-center gap-1.5 text-[11px] text-[#919191]">
          <Source size={11} className="shrink-0" />
          <span className="truncate">
            From {guest.via === "browser" ? "a browser" : "lpm"} · {guest.canType ? "Can type" : "Watching"}
          </span>
        </div>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 px-1 py-1 text-[11px] text-[#919191]">
        Can type
        <Switch
          checked={guest.canType}
          onChange={onSetCanType}
          aria-label={`${guest.name} can type`}
        />
      </label>
      <Tooltip content={`Remove ${guest.name}`} side="bottom">
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${guest.name}`}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#919191] transition-colors hover:bg-[#2a2a2a] hover:text-[#f87171] ${FOCUS_RING}`}
        >
          <X size={13} />
        </button>
      </Tooltip>
    </div>
  );
}
