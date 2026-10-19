import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Users } from "lucide-react";
import { PeerShareLeave } from "../../../bridge/commands";
import { SharedTabTerminal, type SharedTabTerminalHandle } from "./SharedTabTerminal";
import { SharedTabComposer } from "./SharedTabComposer";
import { useComposerStore } from "../../store/composer";
import { useTerminalFontSize } from "../../hooks/useTerminalFontSize";
import { useTerminalTheme } from "../../hooks/useTerminalTheme";
import { getTerminalThemeColors, terminalThemeCssVars } from "../../terminal-themes";
import { refreshJoinedTabs, useTabShares, watchTabShares, type JoinedTab } from "../../store/tabShares";
import { useAppStore } from "../../store/app";

function endedText(tab: JoinedTab): string {
  switch (tab.ended) {
    case "removed":
      return `${tab.hostName} removed you from this tab.`;
    case "closed":
      return `This tab was closed on ${tab.hostName}.`;
    case "left":
      return "You left this tab.";
    default:
      return `${tab.hostName} stopped sharing this tab.`;
  }
}

// A tab someone shared with this machine, live at their terminal's size.
export function SharedTabView() {
  const slug = useTabShares((s) => s.openTab);
  const tab = useTabShares((s) => s.joined.find((j) => j.slug === slug));
  const setOpenTab = useTabShares((s) => s.setOpenTab);
  const setView = useAppStore((s) => s.setView);
  const [leaving, setLeaving] = useState(false);
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
  const canType = !!tab?.canType;

  useEffect(() => watchTabShares(), []);

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

  const live = !tab.ended && !!tab.terminalId;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-2">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
          <Users size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {tab.label || "Shared tab"}
          </div>
          <div className="truncate text-xs text-[var(--text-muted)]">
            Shared by {tab.hostName}
            {tab.project ? ` · ${tab.project}` : ""}
          </div>
        </div>
        {!tab.ended && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              tab.canType
                ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
                : "bg-[var(--bg-active)] text-[var(--text-secondary)]"
            }`}
          >
            {tab.canType ? "You can type" : "View only"}
          </span>
        )}
        <button
          type="button"
          onClick={() => void leave()}
          disabled={leaving}
          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          {tab.ended ? "Remove" : "Leave"}
        </button>
      </div>

      {/* Edge to edge, as a project's terminal is: a narrower box would shrink
          the host's grid a font size below this machine's. */}
      {live ? (
        <div
          style={themeVars}
          className="relative -mx-6 -mb-6 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--border)]"
        >
          <SharedTabTerminal
            key={tab.terminalId}
            ref={terminalRef}
            terminalId={tab.terminalId}
            canType={tab.canType}
            cols={tab.cols}
            rows={tab.rows}
            footer={
              <SharedTabComposer
                terminalId={tab.terminalId}
                label={tab.label || "Shared tab"}
                hostName={tab.hostName}
                canType={tab.canType}
                fontSize={fontSize}
                terminal={terminalRef}
              />
            }
          />
          {!tab.connected && (
            <div className="absolute inset-x-0 top-0 flex justify-center p-2">
              <span className="rounded-full bg-[var(--bg-primary)]/90 px-3 py-1 text-xs text-[var(--text-secondary)] shadow">
                Reconnecting to {tab.hostName}…
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="terminal-surface -mx-6 -mb-6 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 border-t border-[var(--border)] bg-[var(--terminal-bg)] px-6 text-center">
          <p className="text-sm text-[var(--text-primary)]">
            {tab.ended ? endedText(tab) : `Connecting to ${tab.hostName}…`}
          </p>
          {!tab.ended && tab.lastError && (
            <p className="max-w-sm text-xs text-[var(--text-muted)]">{tab.lastError}</p>
          )}
        </div>
      )}
    </div>
  );
}
