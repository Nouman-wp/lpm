import { useEffect, useRef, type KeyboardEvent } from "react";
import { composerValueToText } from "../../composerValue";
import { launchpadCommand } from "../../launchpadCommand";
import type { LaunchpadTab } from "../../launchpadAgentActions";
import type { NewTabPick } from "../../newTabPick";
import { InputComposer, type ComposerValue } from "../InputComposer";
import { LaunchpadDestinationTabs } from "./LaunchpadDestinationTabs";
import { LaunchpadModelMenu } from "./LaunchpadModelMenu";

// The launchpad's prompt: where it goes picked at the top of the box, then a
// task for that agent or a command for a terminal, with the composer's tools
// under it. ↵ starts it in a new tab; left empty, the pick just opens.
export function LaunchpadPrompt({
  projectName,
  projectLabel,
  projectRoot,
  value,
  tabs,
  selected,
  pick,
  focusRequest,
  onChange,
  onSelect,
  onChangePick,
  onStart,
}: {
  projectName: string;
  projectLabel: string;
  projectRoot: string;
  value: ComposerValue;
  tabs: LaunchpadTab[];
  // An option's id, or "terminal".
  selected: string;
  // The model and level a bare CLI opens with; an action brings its own.
  pick: NewTabPick | null;
  // Bumped when ⌘T asked for the launcher, so the prompt takes the keyboard.
  focusRequest: number;
  onChange: (value: ComposerValue) => void;
  onSelect: (id: string) => void;
  onChangePick: (pick: NewTabPick) => void;
  onStart: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusRequest > 0) boxRef.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus({ preventScroll: true });
  }, [focusRequest]);

  const option = tabs.flatMap((t) => t.options).find((o) => o.id === selected) ?? null;
  const text = composerValueToText(value);
  const command = option ? launchpadCommand(text) : text;
  const startLabel = option && command === null ? `Start ${option.label}` : command ? "Run" : "Open Terminal";

  // Plain ↵ in the field starts; Shift+↵ is the composer's own newline.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    if (!(e.target as HTMLElement).isContentEditable) return;
    e.preventDefault();
    onStart();
  };

  return (
    // Framed like the terminal's own composer, which focuses quietly.
    <div
      ref={boxRef}
      onKeyDown={onKeyDown}
      className="[&>[data-input-composer]]:mt-0 [&>[data-input-composer]]:border-[var(--composer-border)] [&>[data-input-composer]]:bg-[var(--composer-surface)] [&>[data-input-composer]:focus-within]:border-[var(--composer-border-focus)]"
    >
      <InputComposer
        onChange={onChange}
        placeholder={
          option ? `Task for ${option.label} (optional)` : "Command to run (optional)"
        }
        header={<LaunchpadDestinationTabs tabs={tabs} value={selected} onChange={onSelect} />}
        history={{ terminalId: projectName, projectName, terminalLabel: projectLabel }}
        aiCwd={projectRoot}
        memory={option ? { project: projectName, agent: option.agent } : undefined}
        footer={
          <>
            <span className="min-w-0 flex-1" />
            {pick && command === null && <LaunchpadModelMenu pick={pick} onChange={onChangePick} />}
            <button
              type="button"
              onClick={onStart}
              disabled={value.pending}
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3 text-[12px] font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {startLabel}
              <kbd className="font-sans text-[11px] opacity-70">↵</kbd>
            </button>
          </>
        }
      />
    </div>
  );
}
