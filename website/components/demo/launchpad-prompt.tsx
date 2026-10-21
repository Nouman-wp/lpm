"use client";

import { useRef } from "react";
import { History } from "lucide-react";
import { AgentGlyph } from "./agent-glyph";
import { ComposerActionsPopover } from "./composer-actions-popover";
import { ComposerIconButton } from "./composer-icon-button";
import { DictateButton } from "./dictate-button";
import { LaunchpadTab } from "./launchpad-tab";
import { launchpadCommand } from "./launchpad-options";
import { NO_AUTOFILL } from "./no-autofill";
import type { DemoAction } from "./projects";
import { TerminalGlyph } from "./terminal-glyph";
import { FOCUS_RING, PRESS } from "./ui";

// Ports the app's LaunchpadPrompt: where it goes picked at the top of the box,
// then a task for that agent or a command for a terminal, with the composer's
// tools under it. ↵ starts it in a new tab; left empty, the pick just opens.
export function LaunchpadPrompt({
  agents,
  option,
  onPick,
  value,
  onChange,
  onStart,
}: {
  agents: DemoAction[];
  option: DemoAction | null;
  onPick: (id: string) => void;
  value: string;
  onChange: (value: string) => void;
  onStart: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusField = () => inputRef.current?.focus();
  const command = option ? launchpadCommand(value.trim()) : value.trim();
  const startLabel = option && command === null ? `Start ${option.label}` : command ? "Run" : "Open Terminal";

  return (
    <div className="rounded-xl border border-[rgba(204,204,204,0.18)] bg-[#262626] transition-colors focus-within:border-[rgba(204,204,204,0.4)]">
      <div
        role="radiogroup"
        aria-label="Start in"
        // A click on a tab leaves the keyboard in the prompt.
        onMouseDown={(e) => e.preventDefault()}
        className="flex flex-wrap items-center gap-1 px-2 pt-2"
      >
        <LaunchpadTab checked={option === null} onClick={() => onPick("terminal")}>
          <TerminalGlyph />
          Terminal
        </LaunchpadTab>
        <span aria-hidden className="mx-1 h-4 w-px bg-[rgba(204,204,204,0.18)]" />
        {agents.map((agent) => (
          <LaunchpadTab
            key={agent.name}
            checked={option?.name === agent.name}
            onClick={() => onPick(agent.name)}
          >
            {agent.agent && <AgentGlyph agent={agent.agent} />}
            {agent.label}
          </LaunchpadTab>
        ))}
      </div>
      <textarea
        ref={inputRef}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
          e.preventDefault();
          onStart();
        }}
        placeholder={option ? `Task for ${option.label} (optional)` : "Command to run (optional)"}
        aria-label={option ? `Task for ${option.label}` : "Command to run"}
        {...NO_AUTOFILL}
        className="block max-h-[200px] min-h-[60px] w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-snug text-[#cccccc] caret-[#cccccc] outline-none placeholder:text-[#8e8e8e]"
      />
      <div className="flex items-center justify-start gap-1 px-2 pb-2">
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
        <ComposerIconButton label="Message history" tooltip="Recent messages" disabled onClick={() => {}}>
          <History className="h-3.5 w-3.5" />
        </ComposerIconButton>
        <span className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={onStart}
          className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-[#cccccc] px-3 text-[12px] font-medium text-[#1a1a1a] hover:opacity-85 ${PRESS} ${FOCUS_RING}`}
        >
          {startLabel}
          <kbd className="font-sans text-[11px] opacity-70">↵</kbd>
        </button>
      </div>
    </div>
  );
}
