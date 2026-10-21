import { useEffect, useState } from "react";
import type { SessionRow } from "../../agentSessions";
import { useLaunchpad, type LaunchpadProject, type LaunchpadTargets } from "../../hooks/useLaunchpad";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import { useRowsThatFit } from "../../hooks/useRowsThatFit";
import type { PersistedHistoryEntry } from "../../terminals";
import type { ActionInfo } from "../../types";
import { composerFontSize } from "../terminal-utils";
import { LaunchpadPrompt } from "./LaunchpadPrompt";
import { LaunchpadSessionRow } from "./LaunchpadSessionRow";

// Three recent sessions always, up to five when the window has the room.
const MIN_RECENT = 3;
const MAX_RECENT = 5;
// From the app's chrome down to the terminal's background over the upper part
// of the page, eased at both ends so no edge shows where it starts or stops.
const FADE_STOPS = [
  [100, 0],
  [96, 8],
  [86, 16],
  [70, 24],
  [50, 32],
  [30, 40],
  [14, 48],
  [4, 56],
  [0, 64],
] as const;
const FADE_IN = `linear-gradient(to bottom, ${FADE_STOPS.map(
  ([chrome, at]) => `color-mix(in srgb, var(--bg-primary) ${chrome}%, var(--terminal-bg)) ${at}%`,
).join(", ")})`;
const CAPTION = "text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

interface EmptyTerminalStateProps extends LaunchpadTargets {
  projectName: string;
  projectLabel: string;
  projectRoot: string;
  // The terminals' font size, so the prompt reads like their composer.
  fontSize: number;
  actions: ActionInfo[];
  sessionHistory: PersistedHistoryEntry[];
  hiddenSessions: ReadonlySet<string>;
  onResumeRow: (row: SessionRow) => void;
  onResumeSession?: () => void;
  newTabAsked: boolean;
  onNewTabHandled: () => void;
}

// A project with no terminals open: a launcher for what's next (the + popup's
// box, laid out on the page) and the last few conversations.
export function EmptyTerminalState({
  projectName,
  projectLabel,
  projectRoot,
  fontSize,
  actions,
  sessionHistory,
  hiddenSessions,
  onResumeRow,
  onResumeSession,
  newTabAsked,
  onNewTabHandled,
  ...targets
}: EmptyTerminalStateProps) {
  const project: LaunchpadProject = { name: projectName, label: projectLabel, root: projectRoot, actions };
  const launchpad = useLaunchpad(project, targets);
  const [focusRequest, setFocusRequest] = useState(0);
  const recent = useRecentSessions(projectName, sessionHistory, hiddenSessions, MAX_RECENT);
  const { pageRef, contentRef, listRef, count } = useRowsThatFit(MIN_RECENT, MAX_RECENT, recent?.length ?? 0);

  // ⌘T with "+ opens Menu" asks for the launcher, and this page is it.
  useEffect(() => {
    if (!newTabAsked) return;
    setFocusRequest((n) => n + 1);
    onNewTabHandled();
  }, [newTabAsked, onNewTabHandled]);

  // On the terminal's own background, like the footer under it and the
  // terminals that replace it, in the terminal theme's colors. The box sits in
  // the middle row, centered on the page whatever its height, and stays put
  // however many sessions load under it.
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ background: FADE_IN }}>
      <div
        ref={pageRef}
        className="terminal-surface composer-terminal-surface grid min-h-0 flex-1 grid-rows-[1fr_auto_1fr] overflow-y-auto px-6"
      >
        <p className="self-end pb-5 pt-10 text-center text-[13px] text-[var(--text-muted)]">
          Open a terminal or start an agent
        </p>
        <div className="mx-auto w-full max-w-3xl">
          <LaunchpadPrompt
            project={project}
            launchpad={launchpad}
            focusRequest={focusRequest}
            fontSize={composerFontSize(fontSize)}
            onSelect={launchpad.select}
            onStart={launchpad.start}
          />
        </div>
        <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-5 self-start pb-10 pt-5">
          {recent && recent.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className={`${CAPTION} px-2.5`}>Pick up where you left off</span>
              <div ref={listRef} className="flex flex-col gap-1">
                {recent.slice(0, count).map((row) => (
                  <LaunchpadSessionRow key={row.key} row={row} onResume={onResumeRow} />
                ))}
              </div>
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
