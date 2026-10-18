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
import { ChevronDown } from "lucide-react";
import { computeStyle } from "../../hooks/useAnchoredPanel";
import { useOverlay } from "../../store/overlay";
import { useSettingsStore } from "../../store/settings";
import { chordLabel } from "../../keys";
import {
  loadNewTabPick,
  newTabPickLabel,
  saveNewTabPick,
  type NewTabPick,
} from "../../newTabPick";
import type { RemoteAgentLaunch } from "../../remoteAgentTabs";
import { HistoryIcon, TerminalIcon } from "../icons";
import { Toggle } from "../ui/Toggle";
import { AgentCascadeMenu } from "./AgentCascadeMenu";
import { AgentGlyph } from "./AgentGlyph";

const POPUP_WIDTH = 360;
const ROW =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 [&>svg]:text-[var(--text-muted)]";

export interface NewTabPopupProps {
  anchorRef: RefObject<HTMLElement | null>;
  // Bumped when it was opened on purpose (a click, ⌘T, right-click, ↓), so the
  // prompt takes the keyboard; 0 while it only shows on hover.
  focusRequest: number;
  hover?: { onPointerEnter: () => void; onPointerLeave: () => void };
  // Clicking or typing inside: leaving it no longer closes it.
  onPin: () => void;
  onClose: () => void;
  onNewTerminal: () => void;
  onOpenAgent: (launch: RemoteAgentLaunch) => void;
  onResumeSession?: () => void;
}

// What + offers: write what the agent should do, pick the agent, model and
// level from the chip under the box, press ↵. Left empty, the agent just opens.
export function NewTabPopup({
  anchorRef,
  focusRequest,
  hover,
  onPin,
  onClose,
  onNewTerminal,
  onOpenAgent,
  onResumeSession,
}: NewTabPopupProps) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [pick, setPick] = useState<NewTabPick>(loadNewTabPick);
  const [prompt, setPrompt] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const askOnPlus = useSettingsStore((s) => s.pickAgentOnNewTab ?? false);
  const updateSettings = useSettingsStore((s) => s.update);
  useOverlay(true);

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setStyle(computeStyle(rect, POPUP_WIDTH, "below", "left", true));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  const placed = style !== null;
  useEffect(() => {
    if (placed && focusRequest > 0) promptRef.current?.focus({ preventScroll: true });
  }, [placed, focusRequest]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (anchorRef.current?.contains(target)) return;
      if (target?.closest?.("[data-new-tab-popup]")) return;
      onCloseRef.current();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [anchorRef]);

  const openAgent = () => {
    saveNewTabPick(pick);
    onOpenAgent({ ...pick, prompt: prompt.trim() || undefined });
    onClose();
  };

  const onPromptKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    openAgent();
  };

  // Escape backs out one step: the menu first, then the popup. It only reaches
  // here from inside, so an Escape meant for the terminal underneath stays there.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      chipRef.current?.focus();
    } else {
      onClose();
    }
  };

  if (!style) return null;

  return createPortal(
    <div
      data-new-tab-popup
      role="dialog"
      aria-label="New tab"
      style={style}
      onPointerEnter={hover?.onPointerEnter}
      onPointerLeave={hover?.onPointerLeave}
      onMouseDown={onPin}
      onFocus={onPin}
      onKeyDown={onKeyDown}
      className="z-[80] flex flex-col overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-1 shadow-xl"
    >
      <div
        data-text-scope
        className="m-0.5 mb-1 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] transition-colors focus-within:border-[var(--text-muted)]"
      >
        <textarea
          ref={promptRef}
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onPromptKeyDown}
          placeholder="What should the agent do? (optional)"
          aria-label="First prompt"
          className="block w-full resize-none bg-transparent px-2.5 pb-1 pt-2 text-[12.5px] leading-[1.4] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <div className="flex items-center gap-1.5 px-1.5 pb-1.5 pt-1">
          <button
            ref={chipRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={`flex h-[26px] min-w-0 items-center gap-1.5 rounded-full border pl-[5px] pr-2 text-[11.5px] transition-colors ${
              menuOpen
                ? "border-[var(--text-muted)] bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <AgentGlyph agent={pick.agent} />
            <span className="truncate">{newTabPickLabel(pick)}</span>
            <ChevronDown size={11} strokeWidth={2} className="shrink-0" />
          </button>
          <button
            type="button"
            onClick={openAgent}
            className="ml-auto flex h-[26px] shrink-0 items-center gap-1.5 rounded-md bg-[var(--text-primary)] px-2.5 text-[12px] font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-85"
          >
            Open
            <span className="opacity-60">↵</span>
          </button>
        </div>
      </div>
      <div className="mx-0.5 my-1 h-px bg-[var(--border)]" />
      <button
        type="button"
        className={ROW}
        onClick={() => {
          onClose();
          onNewTerminal();
        }}
      >
        <TerminalIcon />
        <span className="flex-1">New terminal</span>
        {!askOnPlus && (
          <kbd className="text-[11px] text-[var(--text-muted)]">{chordLabel({ key: "t", meta: true })}</kbd>
        )}
      </button>
      {onResumeSession && (
        <button
          type="button"
          className={ROW}
          onClick={() => {
            onClose();
            onResumeSession();
          }}
        >
          <HistoryIcon />
          <span className="flex-1">Resume a past session…</span>
        </button>
      )}
      <div className="flex items-center gap-3 px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-[var(--text-primary)]">Pick agent and model on +</div>
          <div className="text-[11px] text-[var(--text-muted)]">
            + and {chordLabel({ key: "t", meta: true })} ask what to open.
          </div>
        </div>
        <Toggle
          enabled={askOnPlus}
          onChange={(v) => void updateSettings({ pickAgentOnNewTab: v })}
          aria-label="Pick agent and model on +"
        />
      </div>
      {menuOpen && (
        <AgentCascadeMenu
          anchorRef={chipRef}
          pick={pick}
          onChoose={(next) => {
            setPick(next);
            setMenuOpen(false);
            promptRef.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </div>,
    document.body,
  );
}
