// A section caption in the composer's model menu.
export function ComposerModelCaption({
  label,
  note,
  trailing,
}: {
  label: string;
  note?: string;
  trailing?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      <span>{label}</span>
      {note && <span className="truncate font-normal normal-case tracking-normal opacity-80">{note}</span>}
      {trailing && (
        <span className="ml-auto shrink-0 font-normal normal-case tracking-normal">{trailing}</span>
      )}
    </div>
  );
}
