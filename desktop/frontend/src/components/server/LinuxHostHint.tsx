// The other way to add a server, offered where someone is about to open one
// folder of it: an SSH project per folder adds up on a server that holds several.
export function LinuxHostHint({ disabled = false, onSetUp }: { disabled?: boolean; onSetUp: () => void }) {
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
      Keeping several projects on this server?{" "}
      <button
        type="button"
        onClick={onSetUp}
        disabled={disabled}
        className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline disabled:pointer-events-none disabled:opacity-60"
      >
        Set it up as a Linux host
      </button>{" "}
      instead.
    </p>
  );
}
