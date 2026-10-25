import { commitsText } from "../autoPull";
import type { Announced } from "../autoPullRun";

interface AutoPullRowsProps {
  rows: Announced[];
  onUndo: (row: Announced) => void;
}

/** One line per project an auto pull moved: what came in, and its own Undo. */
export function AutoPullRows({ rows, onUndo }: AutoPullRowsProps) {
  return (
    <ul className="-mx-1 flex flex-col">
      {rows.map((row) => (
        <li key={row.root} className="flex items-center gap-2 rounded-lg py-1.5 pl-2 pr-1 hover:bg-[var(--bg-hover)]">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{row.name}</div>
            <div className="truncate font-mono text-[11.5px] text-[var(--text-muted)]">
              {row.pulled.branch} · {commitsText(row.pulled.count)} · {row.pulled.from} → {row.pulled.to}
            </div>
          </div>
          <button type="button" className="toast-button" onClick={() => onUndo(row)}>
            Undo
          </button>
        </li>
      ))}
    </ul>
  );
}
