import { useSettingsStore } from "../../store/settings";
import { SegmentedControl } from "../ui/SegmentedControl";

const PLUS_OPENS = [
  { value: "terminal", label: "Terminal" },
  { value: "menu", label: "Menu" },
] as const;

// Under the + popup's box: past sessions to resume, and what a click on +
// opens: a terminal, or this popup (which ⌘T then opens too).
export function NewTabFooter({ onResumeSession }: { onResumeSession?: () => void }) {
  const askOnPlus = useSettingsStore((s) => s.pickAgentOnNewTab ?? false);
  const updateSettings = useSettingsStore((s) => s.update);

  return (
    <div className="flex items-center gap-2 pb-0.5 pl-1 pt-1.5">
      {onResumeSession && (
        <button
          type="button"
          onClick={onResumeSession}
          className="flex h-6 shrink-0 items-center rounded-md px-1.5 text-[11.5px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          Resume a past session…
        </button>
      )}
      <span className="min-w-0 flex-1" />
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
