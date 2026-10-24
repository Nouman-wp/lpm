import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useOverlay } from "../store/overlay";
import { TerminalHistoryPopover } from "./TerminalHistoryPopover";

export interface TerminalHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  terminalId: string;
  projectName: string;
  terminalLabel: string;
  onPick: (text: string, images: Record<string, string>) => void;
  onSend?: (text: string, images: Record<string, string>) => void;
  initialCollection?: string;
  // The composer box the popover spans. Without it the box is found by walking
  // up from the trigger.
  boxRef?: RefObject<HTMLElement | null>;
  // What opened the panel: clicks on it toggle rather than count as outside.
  triggerRef?: RefObject<HTMLElement | null>;
  scheduled?: boolean;
}

const GAP = 10;
const MARGIN = 12;
const MAX_HEIGHT = 460;

// The history popover over a composer box, opened from its button or from
// anywhere that names the composer (a toast's Open Drafts).
export function TerminalHistoryPanel({
  open,
  onClose,
  terminalId,
  projectName,
  terminalLabel,
  onPick,
  onSend,
  initialCollection,
  boxRef,
  triggerRef,
  scheduled = false,
}: TerminalHistoryPanelProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const lastGeom = useRef<{ top: number; left: number; right: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useOverlay(open);

  // The popover spans the composer input box (full width), so it's anchored to
  // that box's rect rather than the button. Skip the state update (and
  // re-render) when the box hasn't moved — otherwise scrolling the history list,
  // which a capture-phase scroll listener also sees, would churn.
  const reposition = () => {
    const box = boxRef?.current ?? triggerRef?.current?.closest("[data-composer-box]");
    const r = box?.getBoundingClientRect();
    if (!r) return;
    const prev = lastGeom.current;
    if (prev && prev.top === r.top && prev.left === r.left && prev.right === r.right) return;
    lastGeom.current = { top: r.top, left: r.left, right: r.right };
    setRect(r);
  };

  // The popover is portaled and fixed-positioned (so the composer's
  // overflow-hidden ancestors can't clip it); keep it pinned to the composer box.
  useLayoutEffect(() => {
    if (!open) {
      lastGeom.current = null;
      return;
    }
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  // Outside-click and Escape close the popover. The trigger button and anything
  // marked data-history-overlay (the popover and its portaled child menus, which
  // live outside popRef's subtree) count as inside; a hosted modal
  // (data-modal-overlay) does too, so its backdrop dismisses the modal rather
  // than the popover. Escape is captured so it doesn't also close the composer,
  // but defers to an open child menu, a hosted confirm dialog, or an active
  // folder-name input so it dismisses the topmost layer first.
  useEffect(() => {
    if (!open) return;
    const close = () => onCloseRef.current();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element;
      if (
        triggerRef?.current?.contains(t) ||
        t.closest?.("[data-history-overlay]") ||
        t.closest?.("[data-modal-overlay]")
      )
        return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-history-menu]")) return;
      if (document.querySelector("[data-modal-overlay]")) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.dataset.folderInput !== undefined) return;
      e.stopPropagation();
      close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  if (!open || !rect) return null;

  const style: CSSProperties = {
    position: "fixed",
    left: rect.left,
    width: rect.width,
    bottom: window.innerHeight - rect.top + GAP,
    maxHeight: Math.max(160, Math.min(MAX_HEIGHT, rect.top - GAP - MARGIN)),
  };

  return createPortal(
    <TerminalHistoryPopover
      containerRef={popRef}
      style={style}
      terminalId={terminalId}
      projectName={projectName}
      terminalLabel={terminalLabel}
      initialCollection={initialCollection}
      scheduled={scheduled}
      onClose={onClose}
      onPick={(text, images) => {
        onPick(text, images);
        onClose();
      }}
      onSend={
        onSend
          ? (text, images) => {
              onSend(text, images);
              onClose();
            }
          : undefined
      }
    />,
    document.body,
  );
}
