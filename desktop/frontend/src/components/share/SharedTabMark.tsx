import { Users } from "lucide-react";
import { Tooltip } from "../ui/Tooltip";
import { anyoneTypes, shareTint, useHostedShare, watchingCount } from "../../store/tabShares";

// Marks a tab this machine is sharing, so it's never shared without showing it,
// and says when someone is waiting to be let in.
export function SharedTabMark({ terminalId }: { terminalId: string }) {
  const share = useHostedShare(terminalId);
  if (!share) return null;
  const watching = watchingCount(share);
  const typing = anyoneTypes(share);
  const waiting = share.waiting.length;
  const who =
    watching === 0
      ? "No one is watching"
      : `${watching} ${watching === 1 ? "person is" : "people are"} watching`;
  return (
    <Tooltip
      content={`Shared · ${who}${typing ? " · some can type" : ""}${waiting ? ` · ${waiting} waiting` : ""}`}
      side="bottom"
    >
      <span className="flex shrink-0 items-center gap-1">
        <span className={`flex items-center gap-0.5 ${shareTint(share)}`}>
          <Users size={11} />
          {watching > 0 && <span className="text-[10px] tabular-nums">{watching}</span>}
        </span>
        {waiting > 0 && (
          <span className="flex h-4 items-center gap-1 rounded-full bg-[var(--accent-amber)]/15 px-1.5 text-[10px] font-semibold tabular-nums text-[var(--accent-amber)]">
            <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--accent-amber)]" />
            {waiting}
          </span>
        )}
      </span>
    </Tooltip>
  );
}
