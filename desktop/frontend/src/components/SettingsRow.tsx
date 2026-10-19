import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function SettingsRow({
  id,
  label,
  description,
  children,
  details,
  below,
  footer,
}: {
  id?: string;
  label: string;
  description: string;
  children: ReactNode;
  details?: ReactNode;
  below?: ReactNode;
  footer?: ReactNode;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <div className="px-4 py-3" data-settings-row={id}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-[1_1_12rem]">
          <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
          <p className="text-[11px] text-[var(--text-muted)]">{description}</p>
          {below}
          {details && (
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              className="mt-1 flex items-center gap-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            >
              Learn more
              <ChevronRight size={12} className={`transition-transform ${detailsOpen ? "rotate-90" : ""}`} />
            </button>
          )}
        </div>
        <div className="min-w-0 max-w-full">{children}</div>
      </div>
      {footer}
      {details && (
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${detailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden">
            <div className="space-y-1.5 pt-2 text-xs leading-relaxed text-[var(--text-muted)]">{details}</div>
          </div>
        </div>
      )}
    </div>
  );
}
