import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSettingsStore } from "../../store/settings";
import type { RemoteAgentLaunch } from "../../remoteAgentTabs";
import { NewTabPopup } from "./NewTabPopup";

const noop = () => {};

interface NewTerminalButtonProps {
  className: string;
  children: ReactNode;
  onNewTerminal: () => void;
  onRunCommand: (command: string) => void;
  onOpenAgent: (launch: RemoteAgentLaunch) => void;
  onResumeSession?: () => void;
  // ⌘T asked for the popup here, with the keyboard in it.
  openRequested?: boolean;
  onOpenRequestHandled?: () => void;
}

// The New Terminal button of a view with no terminals yet. With "Pick agent and
// model on +" on it opens what + offers, as ⌘T does here; otherwise a terminal.
export function NewTerminalButton({
  className,
  children,
  onNewTerminal,
  onRunCommand,
  onOpenAgent,
  onResumeSession,
  openRequested = false,
  onOpenRequestHandled = noop,
}: NewTerminalButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  // 0 while closed; bumped on every open so the prompt takes the keyboard.
  const [focusRequest, setFocusRequest] = useState(0);
  const askOnPlus = useSettingsStore((s) => s.pickAgentOnNewTab ?? false);

  useEffect(() => {
    if (!openRequested) return;
    setFocusRequest((n) => n + 1);
    onOpenRequestHandled();
  }, [openRequested, onOpenRequestHandled]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (askOnPlus ? setFocusRequest((n) => n + 1) : onNewTerminal())}
        className={className}
      >
        {children}
      </button>
      {focusRequest > 0 && (
        <NewTabPopup
          anchorRef={buttonRef}
          focusRequest={focusRequest}
          onPin={noop}
          onClose={() => setFocusRequest(0)}
          onNewTerminal={onNewTerminal}
          onRunCommand={onRunCommand}
          onOpenAgent={onOpenAgent}
          onResumeSession={onResumeSession}
        />
      )}
    </>
  );
}
