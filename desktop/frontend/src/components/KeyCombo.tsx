import { Fragment } from "react";
import type { TipSegment } from "./appTips";

const MODIFIERS = new Set(["⌘", "⇧", "⌥", "⌃"]);

// Split a combo label into the caps it renders as. A Mac combo stays one key
// group ("⌘⇧D"), the way menus and tooltips write it; a label spelled in words
// gets a cap per key, split at its pluses ("Ctrl+Shift+T", "Ctrl++").
export function splitKeys(label: string): string[] {
  if (!label) return [];
  if ([...label].some((ch) => MODIFIERS.has(ch))) return [label];
  return label.match(/[^+]+|\+(?=$)/g) ?? [label];
}

function Keycap({ label }: { label: string }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-[var(--composer-active-bg)] px-1.5 text-[11px] font-medium leading-none text-[var(--composer-fg-secondary)]">
      {label}
    </kbd>
  );
}

export function Combo({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {splitKeys(label).map((key, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="text-[9px] text-[var(--composer-fg-muted)]">+</span>
          )}
          <Keycap label={key} />
        </Fragment>
      ))}
    </span>
  );
}

export function renderSegments(segments: TipSegment[]) {
  return segments.map((seg, i) =>
    typeof seg === "string" ? (
      <span key={i}>{seg}</span>
    ) : (
      <Combo key={i} label={seg.kbd} />
    ),
  );
}
