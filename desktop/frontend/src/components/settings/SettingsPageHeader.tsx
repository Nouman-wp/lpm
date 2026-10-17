import type { LucideIcon } from "lucide-react";

export function SettingsPageHeader({
  icon: Icon,
  title,
  description,
  machineName,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /// The connected machine these settings are saved on; unset for this one.
  machineName?: string;
}) {
  return (
    <div className="mb-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <Icon size={18} strokeWidth={1.9} className="shrink-0 text-[var(--text-secondary)]" />
        )}
        <h1 className="shrink-0 text-[19px] font-semibold tracking-tight text-[var(--text-primary)]">
          {title}
        </h1>
        {machineName && (
          <span
            className="truncate rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]"
            title={`Saved on ${machineName}`}
          >
            {machineName}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-muted)]">
          {description}
        </p>
      )}
    </div>
  );
}
