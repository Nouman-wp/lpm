import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { SessionRow } from "../../agentSessions";
import { providerMeta } from "../../agentStatus";
import { composerValueToText } from "../../composerValue";
import type { RunActionOpts } from "../../hooks/useProjectActions";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import {
  agentActionEntries,
  entryAgentActions,
  launchpadActionTabs,
  launchpadPick,
  loadLaunchpadAction,
  runAsGroupChild,
  saveLaunchpadAction,
  type LaunchpadTab,
} from "../../launchpadAgentActions";
import { launchpadCommand } from "../../launchpadCommand";
import { loadNewTabMemory, saveNewTabMemory, type NewTabMemory, type NewTabPick } from "../../newTabPick";
import { peerSlugOf } from "../../peer/markers";
import type { RemoteAgentLaunch } from "../../remoteAgentTabs";
import type { PersistedHistoryEntry } from "../../terminals";
import { AI_CLI_OPTIONS, isAICLI, type ActionInfo } from "../../types";
import { EMPTY_COMPOSER, type ComposerValue } from "../InputComposer";
import { LaunchpadPrompt } from "./LaunchpadPrompt";
import { LaunchpadSessionRow } from "./LaunchpadSessionRow";

const RECENT_SESSIONS = 3;
const CAPTION = "text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

interface EmptyTerminalStateProps {
  projectName: string;
  projectLabel: string;
  projectRoot: string;
  actions: ActionInfo[];
  sessionHistory: PersistedHistoryEntry[];
  hiddenSessions: ReadonlySet<string>;
  onNewTerminal: () => void;
  onRunCommand: (command: string) => void;
  onOpenAgent: (launch: RemoteAgentLaunch) => void;
  onRunAction: (action: ActionInfo, opts?: RunActionOpts) => void;
  onResumeRow: (row: SessionRow) => void;
  onResumeSession?: () => void;
  newTabAsked: boolean;
  onNewTabHandled: () => void;
}

// A project with no terminals open: a launcher for what's next (the + popup's,
// laid out on the page) and the last few conversations.
export function EmptyTerminalState({
  projectName,
  projectLabel,
  projectRoot,
  actions,
  sessionHistory,
  hiddenSessions,
  onNewTerminal,
  onRunCommand,
  onOpenAgent,
  onRunAction,
  onResumeRow,
  onResumeSession,
  newTabAsked,
  onNewTabHandled,
}: EmptyTerminalStateProps) {
  const [memory, setMemory] = useState<NewTabMemory>(loadNewTabMemory);
  // Terminal until something is started from here; then whatever was last.
  const [picked, setPicked] = useState(loadLaunchpadAction);
  const [value, setValue] = useState<ComposerValue>(EMPTY_COMPOSER);
  const [focusRequest, setFocusRequest] = useState(0);
  const recent = useRecentSessions(projectName, sessionHistory, hiddenSessions, RECENT_SESSIONS);

  // The project's own agent actions when it has any, split buttons and menus
  // kept whole; the bare CLIs otherwise.
  const entries = useMemo(() => agentActionEntries(actions), [actions]);
  const tabs = useMemo<LaunchpadTab[]>(
    () =>
      entries.length > 0
        ? launchpadActionTabs(entries, projectName)
        : AI_CLI_OPTIONS.map((o) => {
            const option = { id: o.value, label: providerMeta(o.value).short, agent: o.value };
            return { key: o.value, label: option.label, options: [option], primary: option };
          }),
    [entries, projectName],
  );
  const selected = launchpadPick(
    tabs.flatMap((t) => t.options.map((o) => o.id)),
    picked,
  );
  const pick = entries.length === 0 && isAICLI(selected) ? memory.picks[selected] : null;

  // ⌘T with "+ opens Menu" asks for the launcher, and this page is it.
  useEffect(() => {
    if (!newTabAsked) return;
    setFocusRequest((n) => n + 1);
    onNewTabHandled();
  }, [newTabAsked, onNewTabHandled]);

  const remember = (next: NewTabMemory) => {
    setMemory(next);
    saveNewTabMemory(next);
  };
  const changePick = (pick: NewTabPick) =>
    remember({ ...memory, picks: { ...memory.picks, [pick.agent]: pick } });

  const start = () => {
    if (value.pending) return;
    // Attachments are saved on this Mac, where a paired Mac's agent can't
    // read them; its own tab's composer uploads them instead.
    if (value.images.length > 0 && peerSlugOf(projectName)) {
      toast.error("Images can't go to a connected Mac from here. Start the agent, then attach them in its tab.");
      return;
    }
    saveLaunchpadAction(selected);
    const text = composerValueToText(value);
    const command = selected === "terminal" ? text : launchpadCommand(text);
    if (command !== null) {
      if (command) onRunCommand(command);
      else onNewTerminal();
      return;
    }
    const prompt = text || undefined;
    for (const entry of entries) {
      const launch = entryAgentActions(entry).find((a) => a.action.name === selected);
      if (!launch) continue;
      const action = launch === entry.own ? launch.action : runAsGroupChild(projectName, entry.action, launch.action);
      onRunAction(action, { prompt });
      return;
    }
    if (pick) onOpenAgent({ ...pick, prompt });
  };

  // On the terminal's own background, like the footer under it and the
  // terminals that replace it, in the terminal theme's colors.
  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--border)] bg-[var(--terminal-bg)]">
      <div className="terminal-surface composer-terminal-surface flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
        <div className="m-auto flex w-full max-w-xl flex-col gap-5 py-10">
          <h3 className="text-center text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
            What's next in {projectLabel}?
          </h3>
          <LaunchpadPrompt
            projectName={projectName}
            projectLabel={projectLabel}
            projectRoot={projectRoot}
            value={value}
            tabs={tabs}
            selected={selected}
            pick={pick}
            focusRequest={focusRequest}
            onChange={setValue}
            onSelect={setPicked}
            onChangePick={changePick}
            onStart={start}
          />

          {recent && recent.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className={`${CAPTION} px-2.5`}>Pick up where you left off</span>
              {recent.map((row) => (
                <LaunchpadSessionRow key={row.key} row={row} onResume={onResumeRow} />
              ))}
            </div>
          )}

          {recent && recent.length > 0 && onResumeSession && (
            <button
              type="button"
              onClick={onResumeSession}
              className="mx-auto rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            >
              All sessions
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
