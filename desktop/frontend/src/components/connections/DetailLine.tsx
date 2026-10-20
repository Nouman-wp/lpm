import type { ReactNode } from "react";

// One line in an opened computer's details: what it is, where it stands, and the
// control that changes it.
export function DetailLine({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-[var(--text-primary)]">{title}</p>
        <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">{subtitle}</div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
