import { useRef, type ReactNode } from "react";
import { autoPullTarget } from "../autoPull";
import { useHoverPopup } from "../hooks/useHoverPopup";
import {
  heldByChanges,
  originActionLabel,
  originHeldTitle,
  originMark,
  originMarkTitle,
  type OriginMark,
} from "../originStatus";
import { useAppStore } from "../store/app";
import { useOriginStatus } from "../store/originStatus";
import { useSettingsStore } from "../store/settings";
import { SpinnerIcon } from "./project-detail/icons";
import { SidebarAutoPullCard } from "./SidebarAutoPullCard";

const INCOMING = "text-[var(--accent-sky-text)]";
const QUIET = "text-[var(--text-muted)]";

function markText(mark: OriginMark, incoming = INCOMING): ReactNode {
  switch (mark.kind) {
    case "behind":
      return <span className={incoming}>↓{mark.behind}</span>;
    case "diverged":
      return (
        <>
          <span className={`${QUIET} mr-1.5`}>↑{mark.ahead}</span>
          <span className={incoming}>↓{mark.behind}</span>
        </>
      );
    case "base":
      return mark.onBase ? (
        <span className={incoming}>↓{mark.behind}</span>
      ) : (
        <>
          <span className={`${QUIET} mr-1`}>{mark.base}</span>
          <span className={incoming}>+{mark.behind}</span>
        </>
      );
    case "conflict":
      return <span className="text-[var(--accent-red-text)]">Conflict</span>;
  }
}

// The end of a project row when its branch on origin has moved on: "↓3" at rest.
// On hover it steps aside for SidebarOriginAction, keeping an invisible copy of
// that button's label so the name truncates to make room for it. Grayed, with no
// button, while uncommitted changes stand in the pull's way; resting on it then
// opens the auto pull card, as resting on Pull does.
export function SidebarOriginMark({ root }: { root: string }) {
  const entry = useOriginStatus((s) => s.entries[root]);
  const autostash = useSettingsStore((s) => !!s.gitPull?.autostash);
  const project = useAppStore((s) => autoPullTarget(s.projects, root));
  const heldRef = useRef<HTMLSpanElement>(null);
  const popup = useHoverPopup(heldRef);
  if (!entry) return null;
  if (entry.running) {
    return (
      <span className={`ml-auto flex shrink-0 items-center ${QUIET}`} title="Catching up with origin…">
        <SpinnerIcon />
      </span>
    );
  }
  if (entry.done) {
    return (
      <span className="ml-auto shrink-0 text-[11px] font-medium text-[var(--accent-green-text)]">
        ✓ {entry.done}
      </span>
    );
  }
  const mark = originMark(entry.status);
  if (!mark) return null;
  if (heldByChanges(entry.status, mark, autostash)) {
    const card = mark.kind === "behind" ? project : undefined;
    return (
      <>
        <span
          ref={heldRef}
          {...(card ? popup.trigger : {})}
          className="ml-auto flex shrink-0 items-center text-[11px] font-medium tabular-nums opacity-60"
          title={card ? undefined : originHeldTitle(mark, entry.status)}
        >
          {markText(mark, QUIET)}
        </span>
        {card && popup.open && (
          <SidebarAutoPullCard
            anchorRef={heldRef}
            project={card}
            mark={mark}
            onPointerEnter={popup.panel.onPointerEnter}
            onPointerLeave={popup.panel.onPointerLeave}
            onClose={popup.hide}
          />
        )}
      </>
    );
  }
  return (
    <span
      className="ml-auto flex shrink-0 items-center text-[11px] font-medium tabular-nums"
      title={originMarkTitle(mark, entry.status.branch)}
    >
      <span className="flex items-center group-hover:hidden">
        {markText(mark)}
      </span>
      <span aria-hidden="true" className="invisible hidden px-2 group-hover:inline">
        {originActionLabel(mark)}
      </span>
    </span>
  );
}
