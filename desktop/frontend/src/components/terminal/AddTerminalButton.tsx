import { useCallback, useEffect, useRef, useState } from "react";
import { PlusIcon } from "./icons";
import { useHoverPopup } from "../../hooks/useHoverPopup";
import { useSettingsStore } from "../../store/settings";
import type { RemoteAgentLaunch } from "../../remoteAgentTabs";
import { NewTabPopup } from "./NewTabPopup";

// Long enough that reaching for + to click it doesn't flash the popup first.
const OPEN_DELAY_MS = 300;

interface AddTerminalButtonProps {
  onAddTerminal: () => void;
  onOpenAgent: (launch: RemoteAgentLaunch) => void;
  onResumeSession?: () => void;
  // ⌘T asked for the popup here, with the keyboard in it.
  openRequested: boolean;
  onOpenRequestHandled: () => void;
}

// A click on + opens a terminal. Resting on it shows what else it opens — an
// agent on a chosen model and level, with a first prompt — and with "Pick agent
// and model on +" on, a click opens that instead. Right-click or ↓ opens it
// without the wait.
export function AddTerminalButton({
  onAddTerminal,
  onOpenAgent,
  onResumeSession,
  openRequested,
  onOpenRequestHandled,
}: AddTerminalButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popup = useHoverPopup(buttonRef, OPEN_DELAY_MS);
  const { show, hide, hold } = popup;
  const [focusRequest, setFocusRequest] = useState(0);
  const askOnPlus = useSettingsStore((s) => s.pickAgentOnNewTab ?? false);

  const openOnPurpose = useCallback(() => {
    show();
    hold(true);
    setFocusRequest((n) => n + 1);
  }, [show, hold]);

  const close = useCallback(() => {
    hide();
    hold(false);
    setFocusRequest(0);
  }, [hide, hold]);

  useEffect(() => {
    if (!openRequested) return;
    openOnPurpose();
    onOpenRequestHandled();
  }, [openRequested, openOnPurpose, onOpenRequestHandled]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="New terminal"
        aria-haspopup="dialog"
        aria-expanded={popup.open}
        onClick={() => {
          if (askOnPlus) {
            openOnPurpose();
            return;
          }
          close();
          onAddTerminal();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          openOnPurpose();
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown") return;
          e.preventDefault();
          openOnPurpose();
        }}
        {...popup.trigger}
        className={`ml-1.5 flex h-6 shrink-0 items-center justify-center rounded-md px-1.5 transition-colors duration-150 hover:bg-[var(--terminal-header-hover)] hover:text-[var(--terminal-tab-active)] [&>svg]:h-3.5 [&>svg]:w-3.5 ${
          popup.open
            ? "bg-[var(--terminal-header-hover)] text-[var(--terminal-tab-active)]"
            : "text-[var(--terminal-header-text)]"
        }`}
      >
        <PlusIcon />
      </button>
      {popup.open && (
        <NewTabPopup
          anchorRef={buttonRef}
          focusRequest={focusRequest}
          hover={popup.panel}
          onPin={() => hold(true)}
          onClose={close}
          onNewTerminal={onAddTerminal}
          onOpenAgent={onOpenAgent}
          onResumeSession={onResumeSession}
        />
      )}
    </>
  );
}
