import type { ReactNode } from "react";

export function ImportReportSection({
  title,
  tone,
  note,
  children,
}: {
  title: string;
  tone: "good" | "warn";
  note?: string;
  children: ReactNode;
}) {
  const color = tone === "good" ? "text-[var(--accent-green)]" : "text-amber-500";
  return (
    <div className="mt-4">
      <div className={`text-xs font-medium uppercase tracking-wider ${color}`}>{title}</div>
      {note && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{note}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
