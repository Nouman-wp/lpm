import { useRef } from "react";
import { autoPullTarget } from "../autoPull";
import { useHoverPopup } from "../hooks/useHoverPopup";
import { runOriginAction } from "../originActions";
import { heldByChanges, originActionLabel, originActionTitle, originMark } from "../originStatus";
import { useAppStore } from "../store/app";
import { useOriginStatus } from "../store/originStatus";
import { useSettingsStore } from "../store/settings";
import { SidebarAutoPullCard } from "./SidebarAutoPullCard";

const FILL = {
  incoming:
    "bg-[var(--origin-fill)] text-[var(--origin-label)] shadow-[inset_0_0_0_1px_var(--origin-ring)] hover:bg-[var(--origin-fill-hover)]",
  conflict:
    "bg-[color-mix(in_srgb,var(--accent-red)_22%,var(--bg-hover))] text-[var(--text-primary)] hover:bg-[color-mix(in_srgb,var(--accent-red)_34%,var(--bg-hover))]",
};

// The hover button over a project row's origin mark: Pull, Sync, Update or
// Resolve. It sits beside the row's own button rather than inside it, and lines
// up with the invisible label SidebarOriginMark leaves in the row. Resting on
// Pull opens the auto pull card for this Mac's own projects.
export function SidebarOriginAction({
  root,
  projectName,
  className,
  onResolve,
}: {
  root: string;
  projectName: string;
  className: string;
  onResolve: () => void;
}) {
  const entry = useOriginStatus((s) => s.entries[root]);
  const autostash = useSettingsStore((s) => !!s.gitPull?.autostash);
  const project = useAppStore((s) => autoPullTarget(s.projects, root));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popup = useHoverPopup(buttonRef);
  const mark = entry && !entry.running && !entry.done ? originMark(entry.status) : null;
  if (!entry || !mark || heldByChanges(entry.status, mark, autostash)) return null;
  const conflict = mark.kind === "conflict";
  const title = originActionTitle(mark, entry.status.branch);
  const card = mark.kind === "behind" ? project : undefined;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          popup.hide();
          if (conflict) onResolve();
          else void runOriginAction(root, mark);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        {...(card ? popup.trigger : {})}
        title={card ? undefined : title}
        aria-label={`${title} (${projectName})`}
        aria-haspopup={card ? "dialog" : undefined}
        aria-expanded={card ? popup.open : undefined}
        className={`absolute ${className} flex h-[22px] -translate-y-1/2 items-center rounded-md px-2 text-[11px] font-medium tabular-nums transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 ${
          popup.open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        } ${conflict ? FILL.conflict : FILL.incoming}`}
      >
        {originActionLabel(mark)}
      </button>
      {card && popup.open && (
        <SidebarAutoPullCard
          anchorRef={buttonRef}
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
