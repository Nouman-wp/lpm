import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ComposerToolPresentation } from "../composerTools";
import { HistoryIcon } from "./icons";
import { TerminalHistoryPanel } from "./TerminalHistoryPanel";
import { ContextMenuItem } from "./ui/ContextMenuItem";
import { Tooltip } from "./ui/Tooltip";
import { COMPOSER_TOOLTIP_DELAY_MS } from "../composerText";

export interface TerminalHistoryButtonProps {
  terminalId: string;
  projectName: string;
  terminalLabel: string;
  // Loads the chosen message back into the composer for editing/resending.
  onPick: (text: string, images: Record<string, string>) => void;
  // Fires the chosen message straight at the terminal, skipping the composer.
  // Optional: dialog composers have no terminal, so they omit it (no send button).
  onSend?: (text: string, images: Record<string, string>) => void;
  // Collection the popover opens on; defaults to the unfiltered "All" view.
  initialCollection?: string;
  icon?: ReactNode;
  tooltip?: string;
  ariaLabel?: string;
  // The composer box the popover spans. The button finds it by walking up
  // when it sits inside; a row in a portaled menu has to be handed it.
  boxRef?: RefObject<HTMLElement | null>;
  // Offer the prompts waiting to be sent later. Only a terminal's own input can
  // take one back to edit, so dialog inputs leave it off.
  scheduled?: boolean;
}

export function TerminalHistoryButton({
  terminalId,
  projectName,
  terminalLabel,
  onPick,
  onSend,
  initialCollection,
  icon = <HistoryIcon />,
  tooltip = "Recent messages",
  ariaLabel = "Message history",
  boxRef,
  scheduled = false,
  variant = "button",
  onOpenChange,
}: TerminalHistoryButtonProps & ComposerToolPresentation) {
  const [open, setOpen] = useState(false);
  // The trigger: the icon button, or the row's box when the button is a row.
  const triggerRef = useRef<HTMLElement | null>(null);
  const setTrigger = (el: HTMLElement | null) => {
    triggerRef.current = el;
  };

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const close = useCallback(() => setOpen(false), []);
  const toggleOpen = () => setOpen((v) => !v);

  return (
    <>
      {variant === "row" ? (
        <div ref={setTrigger} className="min-w-0 flex-1">
          <ContextMenuItem label={tooltip} icon={icon} expanded={open} onClick={toggleOpen} />
        </div>
      ) : (
      <Tooltip content={tooltip} delay={COMPOSER_TOOLTIP_DELAY_MS} disabled={open}>
        <button
          ref={setTrigger}
          type="button"
          onClick={toggleOpen}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
            open
              ? "bg-[var(--composer-hover-bg)] text-[var(--composer-fg)]"
              : "text-[var(--composer-fg-muted)] hover:bg-[var(--composer-hover-bg)] hover:text-[var(--composer-fg)]"
          }`}
        >
          {icon}
        </button>
      </Tooltip>
      )}

      <TerminalHistoryPanel
        open={open}
        onClose={close}
        terminalId={terminalId}
        projectName={projectName}
        terminalLabel={terminalLabel}
        onPick={onPick}
        onSend={onSend}
        initialCollection={initialCollection}
        boxRef={boxRef}
        triggerRef={triggerRef}
        scheduled={scheduled}
      />
    </>
  );
}
