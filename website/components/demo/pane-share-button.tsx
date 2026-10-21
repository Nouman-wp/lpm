"use client";

import type { MouseEvent } from "react";
import { UserPlus, Users } from "lucide-react";
import { Tooltip } from "./tooltip";
import { FOCUS_RING } from "./ui";
import { shareTint, type TabShare } from "./use-tab-shares";

// Ports the app's PaneShareButton: Share in the pane header, for the tab in
// front. Opens the share popover under it, or closes it again.
export function PaneShareButton({
  share,
  open,
  onToggle,
}: {
  share?: TabShare;
  open: boolean;
  onToggle: (button: HTMLElement) => void;
}) {
  const watching = share?.guests.length ?? 0;
  const tone = share ? shareTint(share) : "text-[#8e8e8e] hover:text-[#e5e5e5]";
  return (
    <Tooltip content={share ? "Shared · people and link" : "Share this tab"} side="bottom">
      <button
        type="button"
        data-share-button
        aria-expanded={open}
        onClick={(e: MouseEvent<HTMLButtonElement>) => onToggle(e.currentTarget)}
        className={`flex h-6 items-center gap-1 rounded px-1.5 text-[12px] font-medium transition-colors hover:bg-[rgba(255,255,255,0.06)] ${tone} ${
          open ? "bg-[rgba(255,255,255,0.1)]" : ""
        } ${FOCUS_RING}`}
      >
        {share ? <Users size={13} /> : <UserPlus size={13} />}
        {share ? watching > 0 ? <span className="tabular-nums">{watching}</span> : "Shared" : "Share"}
      </button>
    </Tooltip>
  );
}
