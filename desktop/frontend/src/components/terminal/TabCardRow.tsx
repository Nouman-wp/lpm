import type { ReactNode } from "react";

export const TAB_CARD_KEY = "text-[var(--text-muted)]";

/** A row of a tab's hover card: its label, the value, then a muted note. */
export function TabCardRow({
  label,
  value,
  note,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  mono?: boolean;
}) {
  return (
    <>
      <span className={TAB_CARD_KEY}>{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-medium">
        <span className={mono ? "truncate font-mono" : "truncate"}>{value}</span>
        <span className={`shrink-0 font-normal tabular-nums ${TAB_CARD_KEY}`}>· {note}</span>
      </span>
    </>
  );
}
