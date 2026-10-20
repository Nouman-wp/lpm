import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PeerShareLeave } from "../../../bridge/commands";
import { SharedTabTerminal, type SharedTabTerminalHandle } from "./SharedTabTerminal";
import { SharedTabComposer } from "./SharedTabComposer";
import { SharedTabHeader } from "./SharedTabHeader";
import { SharedTabEndedCard } from "./SharedTabEndedCard";
import { useComposerStore } from "../../store/composer";
import { useTerminalFontSize } from "../../hooks/useTerminalFontSize";
import { useTerminalTheme } from "../../hooks/useTerminalTheme";
import { getTerminalThemeColors, terminalThemeCssVars } from "../../terminal-themes";
import { refreshJoinedTabs, useTabShares, watchTabShares, type JoinedTab } from "../../store/tabShares";
import { useAppStore } from "../../store/app";

function endedText(tab: JoinedTab): string {
  switch (tab.ended) {
    case "removed":
      return `${tab.hostName} removed you from this tab`;
    case "closed":
      return `This tab was closed on ${tab.hostName}`;
    case "left":
      return "You left this tab";
    default:
      return `${tab.hostName} stopped sharing this tab`;
  }
}

// A tab someone shared with this machine, live at their terminal's size. When
// it ends, its last screen stays, dimmed, until it's removed.
export function SharedTabView() {
  const slug = useTabShares((s) => s.openTab);
  const tab = useTabShares((s) => s.joined.find((j) => j.slug === slug));
  const setOpenTab = useTabShares((s) => s.setOpenTab);
  const setView = useAppStore((s) => s.setView);
  const [leaving, setLeaving] = useState(false);
  // The tab this view watched live, whose screen it can keep after it ends.
  const [watched, setWatched] = useState<string | null>(null);
  const terminalRef = useRef<SharedTabTerminalHandle>(null);
  const composerOpen = useComposerStore((s) => s.open);
  const { fontSize } = useTerminalFontSize();
  const { theme: terminalTheme } = useTerminalTheme();
  // The user's own terminal theme over the terminal and its prompt box, as
  // their tabs have it.
  const themeVars = useMemo(() => {
    const colors = getTerminalThemeColors(terminalTheme);
    return colors ? (terminalThemeCssVars(colors) as CSSProperties) : undefined;
  }, [terminalTheme]);
  const live = !!tab && !tab.ended && !!tab.terminalId;
  const canType = live && !!tab?.canType;

  useEffect(() => watchTabShares(), []);

  useEffect(() => {
    if (live && tab) setWatched(tab.slug);
  }, [live, tab]);

  // Allowed to type: the keys go to the prompt box, which takes focus itself,
  // or with it closed to the terminal.
  useEffect(() => {
    if (canType && !composerOpen) terminalRef.current?.focus();
  }, [canType, composerOpen]);

  const leave = async () => {
    if (!tab) return;
    setLeaving(true);
    try {
      await PeerShareLeave(tab.slug);
      await refreshJoinedTabs();
    } finally {
      setLeaving(false);
      setOpenTab(null);
      setView("projects");
    }
  };

  if (!tab) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
        This shared tab is no longer here.
      </div>
    );
  }

  const keptScreen = !!tab.ended && !!tab.terminalId && watched === tab.slug;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-2">
      <SharedTabHeader tab={tab} leaving={leaving} onLeave={() => void leave()} />

      {/* Edge to edge, as a project's terminal is: a narrower box would shrink
          the host's grid a font size below this machine's. */}
      {live || keptScreen ? (
        <div
          style={themeVars}
          className="relative -mx-6 -mb-6 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--border)]"
        >
          <SharedTabTerminal
            key={tab.terminalId}
            ref={terminalRef}
            terminalId={tab.terminalId}
            canType={canType}
            cols={tab.cols}
            rows={tab.rows}
            footer={
              live ? (
                <SharedTabComposer
                  slug={tab.slug}
                  terminalId={tab.terminalId}
                  label={tab.label || "Shared tab"}
                  hostName={tab.hostName}
                  canType={tab.canType}
                  asked={tab.asked}
                  askable={tab.askType}
                  fontSize={fontSize}
                  terminal={terminalRef}
                />
              ) : undefined
            }
          />
          {live && !tab.connected && (
            <div className="absolute inset-x-0 top-0 flex justify-center p-2">
              <span className="rounded-full bg-[var(--bg-primary)]/90 px-3 py-1 text-xs text-[var(--text-secondary)] shadow">
                Reconnecting to {tab.hostName}…
              </span>
            </div>
          )}
          {keptScreen && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-[var(--bg-primary)]/55" />
              <SharedTabEndedCard
                title={endedText(tab)}
                onCopy={() => terminalRef.current?.text() ?? ""}
                onRemove={() => void leave()}
              />
            </>
          )}
        </div>
      ) : (
        <div className="terminal-surface -mx-6 -mb-6 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 border-t border-[var(--border)] bg-[var(--terminal-bg)] px-6 text-center">
          <p className="text-sm text-[var(--text-primary)]">
            {tab.ended ? `${endedText(tab)}.` : `Connecting to ${tab.hostName}…`}
          </p>
          {!tab.ended && tab.lastError && (
            <p className="max-w-sm text-xs text-[var(--text-muted)]">{tab.lastError}</p>
          )}
        </div>
      )}
    </div>
  );
}
