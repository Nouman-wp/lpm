import { useState } from "react";
import { ChevronDown, Eye, Keyboard } from "lucide-react";
import { PersonAvatar } from "./PersonAvatar";
import { ShareCard } from "./ShareCard";
import { viaName, type ShareWaiting } from "../../store/tabShares";

// Someone asking to join, as a card that never takes the keyboard. Let in
// gives them what new people get; its menu picks either way for this person.
export function ShareKnockCard({
  waiting,
  label,
  more,
  onDeny,
  onLetIn,
  onLater,
}: {
  waiting: ShareWaiting;
  label: string;
  more: number;
  onDeny: () => void;
  onLetIn: (canType?: boolean) => void;
  onLater: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <ShareCard
      avatar={<PersonAvatar name={waiting.name} size={32} />}
      title={`${waiting.name} wants to join`}
      subtitle={`From ${viaName(waiting.via)} · ${label}`}
      laterHint="Answer later. They keep waiting in the Share list."
      onLater={onLater}
    >
      {waiting.code && (
        <div className="mt-3 flex items-center gap-3 rounded-[10px] bg-[var(--bg-primary)] px-3 py-2.5">
          <span className="shrink-0 text-2xl leading-none tracking-[0.12em]">{waiting.code}</span>
          <span className="text-[11px] leading-[1.4] text-[var(--text-muted)]">
            {waiting.name} sees the same four. Ask which ones if you're unsure.
          </span>
        </div>
      )}
      <div className="relative mt-3 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-muted)]">
          {more > 0 ? `${more} more waiting` : ""}
        </span>
        <button
          type="button"
          onClick={onDeny}
          className="h-8 rounded-lg border border-[var(--border)] px-3 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          Deny
        </button>
        <span className="flex overflow-hidden rounded-lg">
          <button
            type="button"
            onClick={() => onLetIn()}
            className="h-8 bg-[var(--text-primary)] px-3 text-[13px] font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90"
          >
            Let in
          </button>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label="More ways to let in"
            aria-expanded={menu}
            className="flex h-8 w-7 items-center justify-center border-l border-[var(--bg-primary)]/30 bg-[var(--text-primary)] text-[var(--bg-primary)] transition-opacity hover:opacity-90"
          >
            <ChevronDown size={12} strokeWidth={2.5} />
          </button>
        </span>
        {menu && (
          <div className="absolute bottom-10 right-0 z-10 w-[200px] rounded-[10px] border border-[var(--border)] bg-[var(--bg-primary)] p-1 shadow-2xl">
            <button
              type="button"
              onClick={() => onLetIn(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <Eye size={14} />
              Let in to watch
            </button>
            <button
              type="button"
              onClick={() => onLetIn(true)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-[var(--accent-amber)] hover:bg-[var(--bg-hover)]"
            >
              <Keyboard size={14} />
              Let in, can type
            </button>
          </div>
        )}
      </div>
    </ShareCard>
  );
}
