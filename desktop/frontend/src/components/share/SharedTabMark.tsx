import { Users } from "lucide-react";
import { Tooltip } from "../ui/Tooltip";
import { useHostedShare } from "../../store/tabShares";

// Marks a tab this machine is sharing, so it's never shared without showing it.
export function SharedTabMark({ terminalId }: { terminalId: string }) {
  const share = useHostedShare(terminalId);
  if (!share) return null;
  const watching = share.guests.filter((g) => g.connected).length;
  const who =
    watching === 0
      ? "No one is watching"
      : `${watching} ${watching === 1 ? "person is" : "people are"} watching`;
  const tint = share.canType ? "text-[var(--accent-amber)]" : "text-[var(--accent-cyan)]";
  return (
    <Tooltip content={`Shared · ${who}${share.canType ? " · they can type" : ""}`} side="bottom">
      <span className={`flex shrink-0 items-center gap-0.5 ${tint}`}>
        <Users size={11} />
        {watching > 0 && <span className="text-[10px] tabular-nums">{watching}</span>}
      </span>
    </Tooltip>
  );
}
