import { Eye, Keyboard } from "lucide-react";
import { PersonAvatar } from "./PersonAvatar";
import type { JoinedTab } from "../../store/tabShares";

function othersText(others: string[]): string {
  if (others.length === 1) return `${others[0]} is here too`;
  if (others.length === 2) return `${others[0]} and ${others[1]} are here too`;
  return `${others[0]} and ${others.length - 1} others are here too`;
}

// Whose tab this is, whether it's live, who else is watching, and what this
// machine may do in it.
export function SharedTabHeader({
  tab,
  leaving,
  onLeave,
}: {
  tab: JoinedTab;
  leaving: boolean;
  onLeave: () => void;
}) {
  const live = !tab.ended && tab.connected;
  const state = tab.ended ? "Ended" : live ? "Live" : "Reconnecting…";
  return (
    <div className="flex items-center gap-3">
      <PersonAvatar
        name={tab.hostName}
        size={34}
        dot={tab.ended ? "away" : live ? "live" : "reconnecting"}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
          {tab.label || "Shared tab"}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <span
            className={`shrink-0 ${
              tab.ended
                ? ""
                : live
                  ? "text-[var(--accent-green)]"
                  : "text-[var(--accent-amber)]"
            }`}
          >
            {state}
          </span>
          <span className="truncate">
            · {tab.hostName}
            {tab.project ? ` · ${tab.project}` : ""}
          </span>
        </div>
      </div>
      {!tab.ended && tab.others.length > 0 && (
        <span className="flex min-w-0 shrink items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <span className="flex shrink-0">
            {tab.others.slice(0, 3).map((name, i) => (
              <span key={`${name}-${i}`} className={i > 0 ? "-ml-1.5" : ""}>
                <PersonAvatar name={name} size={20} />
              </span>
            ))}
          </span>
          <span className="truncate">{othersText(tab.others)}</span>
        </span>
      )}
      {!tab.ended && (
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            tab.canType
              ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
              : "bg-[var(--bg-active)] text-[var(--text-secondary)]"
          }`}
        >
          {tab.canType ? <Keyboard size={11} /> : <Eye size={11} />}
          {tab.canType ? "You can type" : "View only"}
        </span>
      )}
      <button
        type="button"
        onClick={onLeave}
        disabled={leaving}
        className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
      >
        {tab.ended ? "Remove" : "Leave"}
      </button>
    </div>
  );
}
