import type { MouseEvent } from "react";
import { shortEffortLabel } from "../agentModelMenu";
import type { AIEffortOption } from "../types";

// The level row of the composer's model menu: every level the CLI has, with the
// ones the cursor's model can't take greyed out, so the row keeps one shape as
// the cursor moves between models and shows *why* a level is missing.
export function ComposerLevelSegments({
  idPrefix,
  levels,
  allowed,
  cursor,
  running,
  onMouseDown,
  onHover,
  onChoose,
}: {
  idPrefix: string;
  levels: AIEffortOption[];
  allowed: ReadonlySet<string>;
  cursor: string;
  // The level the session runs, when the cursor is on the model running it.
  running: string;
  onMouseDown: (e: MouseEvent) => void;
  onHover: (effort: string | null) => void;
  onChoose: (effort: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Level"
      onMouseLeave={() => onHover(null)}
      className="mx-2 flex gap-0.5 rounded-lg bg-[var(--bg-secondary)] p-[3px]"
    >
      {levels.map((level) => {
        const offered = allowed.has(level.value);
        const selected = offered && cursor === level.value;
        const checked = offered && running === level.value;
        return (
          <button
            key={level.value}
            id={`${idPrefix}-${level.value}`}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            aria-label={level.label}
            title={level.label}
            disabled={!offered}
            onMouseDown={onMouseDown}
            onMouseEnter={() => offered && onHover(level.value)}
            onClick={() => onChoose(level.value)}
            className={`flex h-7 min-w-0 flex-auto items-center justify-center gap-1 rounded-md px-1.5 text-[11.5px] whitespace-nowrap transition-colors duration-75 ${
              selected
                ? "bg-[var(--bg-active)] font-medium text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.16)]"
                : offered
                  ? "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  : "cursor-default text-[var(--text-muted)] opacity-40"
            }`}
          >
            {checked && (
              <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--accent-cyan)]" />
            )}
            {shortEffortLabel(level.value, level.label)}
          </button>
        );
      })}
    </div>
  );
}
