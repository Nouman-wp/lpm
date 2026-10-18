import { isMac } from "../../platform";
import { useSettingsStore } from "../../store/settings";
import { SegmentedControl } from "../ui/SegmentedControl";

const KEY = "font-sans text-[var(--text-secondary)]";
const NEW_LINE = isMac ? "⇧↵" : "Shift+↵";
const PLUS_OPENS = [
  { value: "terminal", label: "Terminal" },
  { value: "menu", label: "Menu" },
] as const;

// The + popup's keys, and what a click on + opens: a terminal, or this menu
// (which ⌘T then opens too).
export function NewTabFooter() {
  const askOnPlus = useSettingsStore((s) => s.pickAgentOnNewTab ?? false);
  const updateSettings = useSettingsStore((s) => s.update);

  return (
    <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] py-1.5 pl-3 pr-1.5">
      <span className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden whitespace-nowrap text-[11px] text-[var(--text-muted)]">
        <span>
          <kbd className={KEY}>↑↓</kbd> choose
        </span>
        <span>
          <kbd className={KEY}>↵</kbd> open
        </span>
        <span>
          <kbd className={KEY}>{NEW_LINE}</kbd> new line
        </span>
      </span>
      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">+ opens</span>
      <SegmentedControl
        ariaLabel="Clicking + opens"
        value={askOnPlus ? "menu" : "terminal"}
        options={PLUS_OPENS}
        onChange={(value) => void updateSettings({ pickAgentOnNewTab: value === "menu" })}
      />
    </div>
  );
}
