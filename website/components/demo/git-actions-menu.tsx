"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { AiGitRow } from "./ai-git-row";
import { FlagRow } from "./flag-row";
import {
  FetchIcon,
  MergeIcon,
  PullIcon,
  PullRequestIcon,
  PushIcon,
  UndoIcon,
} from "./git-menu-icons";
import { GitModeScreen } from "./git-mode-screen";
import {
  PULL_STRATEGY_LABELS,
  PUSH_MODE_LABELS,
  type GitPrefs,
  type PullStrategy,
  type PushMode,
} from "./git-prefs";
import { MenuSplitRow } from "./menu-split-row";
import { FOCUS_RING } from "./ui";

const ROW = `flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] text-[#b3b3b3] transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`;
const PULL_STRATEGIES = Object.keys(PULL_STRATEGY_LABELS) as PullStrategy[];
const PUSH_MODES = Object.keys(PUSH_MODE_LABELS) as PushMode[];

type AutoAction = "commit" | "commit-push" | "pr";
type Screen = "root" | "pull" | "pull-advanced" | "push" | "push-advanced" | "fetch";

const SCREENS: Record<Exclude<Screen, "root">, { title: string; back: Screen }> = {
  pull: { title: "Pull", back: "root" },
  "pull-advanced": { title: "Pull · Advanced", back: "pull" },
  push: { title: "Push", back: "root" },
  "push-advanced": { title: "Push · Advanced", back: "push" },
  fetch: { title: "Fetch", back: "root" },
};

// Ports the app's git menu under Commit's chevron: Pull, Push and Fetch run
// their default or open their settings, then PRs, merging, the AI rows and
// discarding.
export function GitActionsMenu({
  busy,
  uncommitted,
  prefs,
  onPrefs,
  onPull,
  onPush,
  onFetch,
  onCreatePR,
  onMerge,
  onDiscard,
  onAutoCommit,
  onAutoCommitAndPush,
  onAutoCreatePR,
}: {
  busy: boolean;
  uncommitted: number;
  prefs: GitPrefs;
  onPrefs: (prefs: GitPrefs) => void;
  onPull: () => void;
  onPush: () => void;
  onFetch: () => void;
  onCreatePR: () => void;
  onMerge: () => void;
  onDiscard: () => void;
  onAutoCommit: () => void;
  onAutoCommitAndPush: () => void;
  onAutoCreatePR: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("root");
  const [generating, setGenerating] = useState<AutoAction | null>(null);
  const genTimer = useRef<number | null>(null);

  // Closing the menu unmounts it, so a pending run would otherwise commit for a
  // visitor who already dismissed the menu.
  useEffect(
    () => () => {
      if (genTimer.current) window.clearTimeout(genTimer.current);
    },
    [],
  );

  const runAuto = (action: AutoAction, run: () => void) => {
    if (genTimer.current) window.clearTimeout(genTimer.current);
    setGenerating(action);
    genTimer.current = window.setTimeout(() => {
      genTimer.current = null;
      setGenerating(null);
      run();
    }, 650);
  };

  const pull = (patch: Partial<GitPrefs["pull"]>) =>
    onPrefs({ ...prefs, pull: { ...prefs.pull, ...patch } });
  const push = (patch: Partial<GitPrefs["push"]>) =>
    onPrefs({ ...prefs, push: { ...prefs.push, ...patch } });
  const fetch = (patch: Partial<GitPrefs["fetch"]>) =>
    onPrefs({ ...prefs, fetch: { ...prefs.fetch, ...patch } });

  const noChanges = uncommitted === 0;

  return (
    <div className="menu-pop absolute bottom-full right-0 z-50 mb-2 w-80 overflow-hidden rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] py-1.5 shadow-2xl">
      {screen === "root" ? (
        <>
          <MenuSplitRow
            icon={<PullIcon />}
            label={PULL_STRATEGY_LABELS[prefs.pull.strategy]}
            configureLabel="Configure pull"
            disabled={busy}
            onRun={onPull}
            onConfigure={() => setScreen("pull")}
          />
          <MenuSplitRow
            icon={<PushIcon />}
            label={PUSH_MODE_LABELS[prefs.push.mode]}
            configureLabel="Configure push"
            disabled={busy}
            onRun={onPush}
            onConfigure={() => setScreen("push")}
          />
          <MenuSplitRow
            icon={<FetchIcon />}
            label="Fetch"
            configureLabel="Configure fetch"
            disabled={busy}
            onRun={onFetch}
            onConfigure={() => setScreen("fetch")}
          />
          <button type="button" onClick={onCreatePR} className={ROW}>
            <PullRequestIcon />
            Create PR
          </button>
          <button type="button" onClick={onMerge} disabled={busy} className={ROW}>
            <MergeIcon />
            Merge
          </button>
          <div className="my-1.5 border-t border-[#2e2e2e]" />
          <AiGitRow
            label="Auto Commit"
            description="AI writes the message, then commits"
            generating={generating === "commit"}
            disabled={busy || noChanges || generating !== null}
            onClick={() => runAuto("commit", onAutoCommit)}
          />
          <AiGitRow
            label="Auto Commit and Push"
            description="AI writes the message, commits, and pushes"
            generating={generating === "commit-push"}
            disabled={busy || noChanges || generating !== null}
            onClick={() => runAuto("commit-push", onAutoCommitAndPush)}
          />
          <AiGitRow
            label="Auto Create PR"
            description="AI names the branch, commits, pushes, and opens the PR"
            generating={generating === "pr"}
            disabled={busy || generating !== null}
            onClick={() => runAuto("pr", onAutoCreatePR)}
          />
          <div className="my-1.5 border-t border-[#2e2e2e]" />
          <button
            type="button"
            onClick={onDiscard}
            disabled={noChanges}
            className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] text-[#f87171] transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
          >
            <UndoIcon />
            Discard all changes
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setScreen(SCREENS[screen].back)}
            className={`mx-2 mb-1 flex items-center gap-1 rounded-lg py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[#b3b3b3]">
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="min-w-0 truncate text-[12.5px] font-medium text-[#e5e5e5]">
              {SCREENS[screen].title}
            </span>
          </button>
          {screen === "pull" && (
            <GitModeScreen
              options={PULL_STRATEGIES}
              labels={PULL_STRATEGY_LABELS}
              value={prefs.pull.strategy}
              busy={busy}
              runLabel="Run pull"
              onSelect={(strategy) => pull({ strategy })}
              onAdvanced={() => setScreen("pull-advanced")}
              onRun={onPull}
            />
          )}
          {screen === "pull-advanced" && (
            <>
              <FlagRow
                label="Autostash"
                flag="--autostash"
                checked={prefs.pull.autostash}
                disabled={busy}
                onToggle={() => pull({ autostash: !prefs.pull.autostash })}
              />
              <FlagRow
                label="No verify"
                flag="--no-verify"
                checked={prefs.pull.noVerify}
                disabled={busy}
                onToggle={() => pull({ noVerify: !prefs.pull.noVerify })}
              />
            </>
          )}
          {screen === "push" && (
            <GitModeScreen
              options={PUSH_MODES}
              labels={PUSH_MODE_LABELS}
              value={prefs.push.mode}
              busy={busy}
              runLabel="Run push"
              onSelect={(mode) => push({ mode })}
              onAdvanced={() => setScreen("push-advanced")}
              onRun={onPush}
            />
          )}
          {screen === "push-advanced" && (
            <>
              <FlagRow
                label="No verify"
                flag="--no-verify"
                checked={prefs.push.noVerify}
                disabled={busy}
                onToggle={() => push({ noVerify: !prefs.push.noVerify })}
              />
              <FlagRow
                label="Push tags"
                flag="--tags"
                checked={prefs.push.tags}
                disabled={busy}
                onToggle={() => push({ tags: !prefs.push.tags })}
              />
            </>
          )}
          {screen === "fetch" && (
            <>
              <FlagRow
                label="All remotes"
                flag="--all"
                checked={prefs.fetch.all}
                disabled={busy}
                onToggle={() => fetch({ all: !prefs.fetch.all })}
              />
              <FlagRow
                label="Prune"
                flag="--prune"
                checked={prefs.fetch.prune}
                disabled={busy}
                onToggle={() => fetch({ prune: !prefs.fetch.prune })}
              />
              <FlagRow
                label="Prune tags"
                flag="--prune-tags"
                checked={prefs.fetch.pruneTags}
                disabled={busy}
                onToggle={() => fetch({ pruneTags: !prefs.fetch.pruneTags })}
              />
              <FlagRow
                label="Tags"
                flag="--tags"
                checked={prefs.fetch.tags}
                disabled={busy}
                onToggle={() => fetch({ tags: !prefs.fetch.tags })}
              />
              <button
                type="button"
                onClick={onFetch}
                disabled={busy}
                className={`mx-1.5 mt-1 flex w-[calc(100%-12px)] items-center justify-center rounded-lg px-2.5 py-2 text-[13px] font-medium text-[#4ade80] transition-colors hover:bg-[#2a2a2a] disabled:opacity-40 ${FOCUS_RING}`}
              >
                Run fetch
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
