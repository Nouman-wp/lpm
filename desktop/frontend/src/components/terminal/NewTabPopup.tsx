import {
  Fragment,
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
import { useOverlay } from "../../store/overlay";
import { useSettingsStore } from "../../store/settings";
import { chordLabel } from "../../keys";
import { AI_CLI_OPTIONS, type AICLI } from "../../types";
import {
  loadNewTabMemory,
  newTabModelLabel,
  saveNewTabMemory,
  type NewTabDestination,
  type NewTabMemory,
  type NewTabPick,
} from "../../newTabPick";
import type { RemoteAgentLaunch } from "../../remoteAgentTabs";
import { HistoryIcon, TerminalIcon } from "../icons";
import { AgentGlyph } from "./AgentGlyph";
import { LauncherModelChip } from "./LauncherModelChip";
import { LauncherModelPicker } from "./LauncherModelPicker";
import { LauncherRow } from "./LauncherRow";
import { NewTabFooter } from "./NewTabFooter";

const POPUP_WIDTH = 388;
const CAPTION =
  "px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

type Destination = NewTabDestination | "resume";

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
  // What was typed, run in a new terminal.
  onRunCommand: (command: string) => void;
  onOpenAgent: (launch: RemoteAgentLaunch) => void;
  onResumeSession?: () => void;
}

// ↑ on the prompt's first line and ↓ on its last move the cursor; elsewhere
// they move the caret between the prompt's lines.
function caretMoves(el: HTMLTextAreaElement, key: string): boolean {
  return key === "ArrowUp"
    ? el.value.slice(0, el.selectionStart).includes("\n")
    : el.value.slice(el.selectionEnd).includes("\n");
}

// What + offers: type a task or a command, then pick where it goes. An agent
// takes it as its first prompt, on the model and level its row shows; a
// terminal runs it. Left empty, the pick just opens.
export function NewTabPopup({
  anchorRef,
  focusRequest,
  hover,
  onPin,
  onClose,
  onNewTerminal,
  onRunCommand,
  onOpenAgent,
  onResumeSession,
}: NewTabPopupProps) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [memory, setMemory] = useState<NewTabMemory>(loadNewTabMemory);
  const [cursor, setCursor] = useState<Destination>(memory.last);
  const [expanded, setExpanded] = useState<AICLI | null>(null);
  const [text, setText] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const askOnPlus = useSettingsStore((s) => s.pickAgentOnNewTab ?? false);
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

  const command = text.trim();
  const firstLine = command.split("\n")[0];
  const destinations: Destination[] = [
    ...AI_CLI_OPTIONS.map((o) => o.value),
    "terminal",
    ...(onResumeSession ? (["resume"] as const) : []),
  ];

  const changePick = (pick: NewTabPick) => {
    const next = { ...memory, picks: { ...memory.picks, [pick.agent]: pick } };
    setMemory(next);
    saveNewTabMemory(next);
  };

  const choose = (destination: Destination) => {
    if (destination !== "resume") saveNewTabMemory({ ...memory, last: destination });
    onClose();
    if (destination === "resume") onResumeSession?.();
    else if (destination !== "terminal") {
      onOpenAgent({ ...memory.picks[destination], prompt: command || undefined });
    } else if (command) onRunCommand(command);
    else onNewTerminal();
  };

  const toggleExpanded = (agent: AICLI) => {
    setCursor(agent);
    setExpanded((open) => (open === agent ? null : agent));
    promptRef.current?.focus({ preventScroll: true });
  };

  const onPromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    choose(cursor);
  };

  // Escape backs out one step: the open picker first, then the popup. It only
  // reaches here from inside, so an Escape meant for the terminal underneath
  // stays there.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (expanded) setExpanded(null);
      else onClose();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (e.target instanceof HTMLTextAreaElement && caretMoves(e.target, e.key)) return;
    e.preventDefault();
    const at = Math.max(0, destinations.indexOf(cursor));
    const next = at + (e.key === "ArrowDown" ? 1 : -1);
    setCursor(destinations[Math.min(destinations.length - 1, Math.max(0, next))]);
  };

  if (!style) return null;
  const typed = command !== "";

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
      className="z-[80] flex flex-col overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl"
    >
      <div
        data-text-scope
        className="flex items-start gap-2 border-b border-[var(--border)] px-3 pb-2 pt-2.5"
      >
        <span aria-hidden className="font-mono text-[13px] leading-[19px] text-[var(--text-muted)]">
          ›
        </span>
        <textarea
          ref={promptRef}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onPromptKeyDown}
          placeholder="Type a task or a command, then pick where it goes"
          aria-label="Task or command"
          className="block min-w-0 flex-1 resize-none bg-transparent p-0 text-[13px] leading-[19px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </div>
      <div role="group" aria-label={typed ? "Send to" : "Open"} className="flex flex-col gap-px p-1.5">
        <div aria-hidden className={CAPTION}>
          {typed ? "Send to" : "Open"}
        </div>
        {AI_CLI_OPTIONS.map((o) => {
          const pick = memory.picks[o.value];
          const modelLabel = newTabModelLabel(pick);
          const active = cursor === o.value;
          const open = expanded === o.value;
          return (
            <Fragment key={o.value}>
              <LauncherRow
                label={o.label}
                leading={<AgentGlyph agent={o.value} />}
                sub={typed && active ? `Starts with “${firstLine}”` : undefined}
                active={active}
                onPoint={() => setCursor(o.value)}
                onChoose={() => choose(o.value)}
                trailing={
                  modelLabel && (
                    <LauncherModelChip
                      label={modelLabel}
                      agentLabel={o.label}
                      open={open}
                      active={active}
                      onToggle={() => toggleExpanded(o.value)}
                    />
                  )
                }
              />
              {open && <LauncherModelPicker pick={pick} onChange={changePick} />}
            </Fragment>
          );
        })}
        <div className="mx-2 my-1 h-px bg-[var(--border)]" />
        <LauncherRow
          label={typed ? "Run in a new terminal" : "New terminal"}
          leading={<TerminalIcon />}
          sub={typed ? `$ ${firstLine}` : undefined}
          mono
          active={cursor === "terminal"}
          onPoint={() => setCursor("terminal")}
          onChoose={() => choose("terminal")}
          trailing={
            !askOnPlus &&
            cursor !== "terminal" && (
              <kbd className="shrink-0 font-sans text-[11px] text-[var(--text-muted)]">
                {chordLabel({ key: "t", meta: true })}
              </kbd>
            )
          }
        />
        {onResumeSession && (
          <LauncherRow
            label="Resume a past session…"
            leading={<HistoryIcon />}
            active={cursor === "resume"}
            onPoint={() => setCursor("resume")}
            onChoose={() => choose("resume")}
          />
        )}
      </div>
      <NewTabFooter />
    </div>,
    document.body,
  );
}
