import { UserPlus, Users } from "lucide-react";
import { Tooltip } from "../ui/Tooltip";
import { shareTint, useHostedShare, useTabShares, watchingCount } from "../../store/tabShares";

// Share in the pane header, for the tab in front: opens the share popover
// under it, or closes it again.
export function PaneShareButton({
  terminalId,
  project,
  label,
}: {
  terminalId: string;
  project: string;
  label: string;
}) {
  const share = useHostedShare(terminalId);
  const open = useTabShares((s) => s.shareDialog?.terminalId === terminalId);
  const watching = share ? watchingCount(share) : 0;
  const tone = share
    ? shareTint(share)
    : "text-[var(--terminal-header-text)] hover:text-[var(--terminal-tab-active)]";

  return (
    <Tooltip content={share ? "Shared · people and link" : "Share this tab"} side="bottom" align="end">
      <button
        type="button"
        data-share-button
        aria-expanded={open}
        onClick={(e) => {
          const { shareDialog, openShareDialog, closeShareDialog } = useTabShares.getState();
          if (shareDialog?.terminalId === terminalId) return closeShareDialog();
          const r = e.currentTarget.getBoundingClientRect();
          openShareDialog({
            terminalId,
            project,
            label,
            anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
          });
        }}
        className={`flex h-6 items-center gap-1 rounded px-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--terminal-header-hover)] ${tone} ${
          open ? "bg-[var(--terminal-header-active)]" : ""
        }`}
      >
        {share ? <Users size={13} /> : <UserPlus size={13} />}
        {share ? (watching > 0 ? <span className="tabular-nums">{watching}</span> : "Shared") : "Share"}
      </button>
    </Tooltip>
  );
}
