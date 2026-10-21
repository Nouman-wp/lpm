"use client";

import { History, Plus } from "lucide-react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { ComposerActionsPopover } from "./composer-actions-popover";
import { ComposerIconButton } from "./composer-icon-button";
import { ComposerSendButton } from "./composer-send-button";
import { DictateButton } from "./dictate-button";
import { NO_AUTOFILL } from "./no-autofill";
import { shortDuration, useSecondsClock } from "./use-seconds-clock";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  busy: boolean;
  placeholder: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onRecall: () => void;
  canRecall: boolean;
  /** When the turn in flight began, so the composer can say how long the agent
   *  has been at it — what the app shows here instead of a spinner. */
  workingSince?: number;
  // Rendered in the footer row, to the left of Send.
  trailing?: ReactNode;
};

export function AgentComposer({
  value,
  onChange,
  onSubmit,
  busy,
  placeholder,
  inputRef,
  onRecall,
  canRecall,
  workingSince,
  trailing,
}: Props) {
  const focusField = () => inputRef.current?.focus();

  return (
    <div className="shrink-0 border-t border-[rgba(204,204,204,0.18)] bg-[#1a1a1a] px-3 pb-1 pt-2">
      <form onSubmit={onSubmit} autoComplete="off">
        {/* The box stays neutral while the agent works. In the app the spinning
            ring belongs to a composer transform, not to a turn in flight; what
            a working turn puts here is an elapsed reading. */}
        <div className="rounded-xl p-px">
          {/* The app's own focus border is too faint to be the whole indicator,
              so the box also takes the demo's blue ring while the field itself
              holds focus — the footer buttons keep their own FOCUS_RING. */}
          <div className="rounded-xl border border-[rgba(204,204,204,0.18)] bg-[#262626] transition-colors focus-within:border-[rgba(204,204,204,0.4)] has-[input:focus-visible]:border-[#60a5fa] has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-[#60a5fa]">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              {...NO_AUTOFILL}
              className="block w-full bg-transparent px-3.5 py-1.5 font-mono text-[12px] leading-[1.5] text-[#cccccc] caret-[#cccccc] outline-none placeholder:text-[#8e8e8e]"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <div className="flex items-center gap-1">
                <DictateButton
                  onTranscript={(text) => {
                    const typed = value.trimEnd();
                    onChange(typed ? `${typed} ${text}` : text);
                    focusField();
                  }}
                />
                <ComposerActionsPopover
                  value={value}
                  onApply={(text) => {
                    onChange(text);
                    focusField();
                  }}
                />
                <ComposerIconButton
                  label="New input"
                  tooltip={"New prompt  ·  ⌘⇧T"}
                  onClick={() => {
                    onChange("");
                    focusField();
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </ComposerIconButton>
                <ComposerIconButton
                  label="Message history"
                  tooltip="Recent messages"
                  disabled={!canRecall}
                  onClick={onRecall}
                >
                  <History className="h-3.5 w-3.5" />
                </ComposerIconButton>
                {busy && workingSince !== undefined && (
                  <WorkingFor since={workingSince} />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {trailing}
                <ComposerSendButton disabled={!value.trim()} />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

/** How long the agent has been on this turn, beside the composer's own
 *  controls — the app's compact status chip. */
function WorkingFor({ since }: { since: number }) {
  const now = useSecondsClock(false);
  const elapsed = shortDuration(now - since);
  return (
    <span
      title={`Working for ${elapsed}`}
      className="ml-1 shrink-0 select-none text-[11px] tabular-nums text-[#8e8e8e]"
    >
      {elapsed}
    </span>
  );
}
