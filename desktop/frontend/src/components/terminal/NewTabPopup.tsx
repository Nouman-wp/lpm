import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { computeStyle } from "../../hooks/useAnchoredPanel";
import { useLaunchpad, type LaunchpadProject, type LaunchpadTargets } from "../../hooks/useLaunchpad";
import { useOverlay } from "../../store/overlay";
import { LaunchpadPrompt } from "../project-detail/LaunchpadPrompt";
import { NewTabFooter } from "./NewTabFooter";

const POPUP_WIDTH = 480;
const PLACEMENT = ["left", "top", "bottom", "maxHeight"] as const;

export interface NewTabPopupProps extends LaunchpadTargets {
  project: LaunchpadProject;
  anchorRef: RefObject<HTMLElement | null>;
  // Bumped when it was opened on purpose (a click, ⌘T, right-click, ↓), so the
  // prompt takes the keyboard; 0 while it only shows on hover.
  focusRequest: number;
  hover?: { onPointerEnter: () => void; onPointerLeave: () => void };
  // Clicking or typing inside: leaving it no longer closes it.
  onPin: () => void;
  onClose: () => void;
  onResumeSession?: () => void;
}

// What + offers, in the empty project's box: where it goes picked at the top,
// then a task for that agent or a command for a terminal. ↵ starts it in a new
// tab; left empty, the pick just opens.
export function NewTabPopup({
  project,
  anchorRef,
  focusRequest,
  hover,
  onPin,
  onClose,
  onResumeSession,
  ...targets
}: NewTabPopupProps) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const launchpad = useLaunchpad(project, targets);
  const [focusTick, setFocusTick] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  // Its menus (a model, a split button's items, the prompt history) render
  // outside it, but a press in one still reaches it through React first.
  const pressedInside = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useOverlay(true);

  // Any scroll reaches the listener, the prompt's own and its history's too:
  // only a move of the anchor re-renders the popup.
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = computeStyle(rect, POPUP_WIDTH, "below", "left", true);
      setStyle((prev) => (prev && PLACEMENT.every((k) => prev[k] === next[k]) ? prev : next));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (pressedInside.current) {
        pressedInside.current = false;
        return;
      }
      if (anchorRef.current?.contains(e.target as Node)) return;
      onCloseRef.current();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [anchorRef]);

  // Picked while it only shows on hover: the keyboard moves into the prompt
  // for what goes there.
  const select = (id: string) => {
    launchpad.select(id);
    if (!popupRef.current?.contains(document.activeElement)) setFocusTick((n) => n + 1);
  };

  const start = () => {
    if (launchpad.start()) onClose();
  };

  const resume =
    onResumeSession &&
    (() => {
      onClose();
      onResumeSession();
    });

  // Only reaches here from inside, so an Escape meant for the terminal
  // underneath stays there; an open menu in it takes Escape first.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  if (!style) return null;

  return createPortal(
    <div
      ref={popupRef}
      role="dialog"
      aria-label="New tab"
      style={style}
      onPointerEnter={hover?.onPointerEnter}
      onPointerLeave={hover?.onPointerLeave}
      onMouseDown={() => {
        pressedInside.current = true;
        onPin();
      }}
      onFocus={onPin}
      onKeyDown={onKeyDown}
      className="z-[80] flex flex-col overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-1.5 shadow-2xl"
    >
      <LaunchpadPrompt
        project={project}
        launchpad={launchpad}
        focusRequest={focusRequest + focusTick}
        onSelect={select}
        onStart={start}
      />
      <NewTabFooter onResumeSession={resume} />
    </div>,
    document.body,
  );
}
