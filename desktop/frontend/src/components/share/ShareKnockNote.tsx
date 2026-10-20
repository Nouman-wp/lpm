export interface KnockNote {
  text: string;
  tone: "watch" | "type" | "out";
  undo?: () => void;
}

const DOT = {
  watch: "bg-[var(--accent-green)]",
  type: "bg-[var(--accent-amber)]",
  out: "bg-[var(--text-muted)]",
} as const;

// What the last answer did, with a way back while there still is one.
export function ShareKnockNote({ note }: { note: KnockNote }) {
  return (
    <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] py-2 pl-3 pr-1.5 text-[13px] text-[var(--text-primary)] shadow-xl">
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[note.tone]}`} />
      <span className="min-w-0 flex-1 truncate">{note.text}</span>
      {note.undo && (
        <button
          type="button"
          onClick={note.undo}
          className="h-7 shrink-0 rounded-md px-2.5 text-xs font-semibold text-[var(--accent-cyan)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          Undo
        </button>
      )}
    </div>
  );
}
