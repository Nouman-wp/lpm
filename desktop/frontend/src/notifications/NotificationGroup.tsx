import type { NotificationEntry } from "./history";
import { NotificationRow } from "./NotificationRow";
import type { ToastAction } from "./types";

interface NotificationGroupProps {
  title: string;
  entries: NotificationEntry[];
  onAct: (entry: NotificationEntry, action: ToastAction) => void;
}

export function NotificationGroup({ title, entries, onAct }: NotificationGroupProps) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h3 className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {title}
      </h3>
      <ul>
        {entries.map((entry) => (
          <NotificationRow key={entry.id} entry={entry} onAct={onAct} />
        ))}
      </ul>
    </section>
  );
}
