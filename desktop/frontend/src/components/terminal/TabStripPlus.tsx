import type { ComponentProps } from "react";
import { useSettingsStore } from "../../store/settings";
import { PlusIcon } from "./icons";

interface TabStripPlusProps extends Omit<ComponentProps<"button">, "onClick"> {
  // What + opens is showing.
  open?: boolean;
  onAdd: () => void;
  onPick: () => void;
}

// The tab strip's +: a click opens a terminal, or the pick with "Pick agent and
// model on +" on; right-click or ↓ opens the pick.
export function TabStripPlus({ open = false, onAdd, onPick, ...rest }: TabStripPlusProps) {
  const askOnPlus = useSettingsStore((s) => s.pickAgentOnNewTab ?? false);
  return (
    <button
      type="button"
      aria-label="New terminal"
      onClick={() => (askOnPlus ? onPick() : onAdd())}
      onContextMenu={(e) => {
        e.preventDefault();
        onPick();
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown") return;
        e.preventDefault();
        onPick();
      }}
      {...rest}
      className={`ml-1.5 flex h-6 shrink-0 items-center justify-center rounded-md px-1.5 transition-colors duration-150 hover:bg-[var(--terminal-header-hover)] hover:text-[var(--terminal-tab-active)] [&>svg]:h-3.5 [&>svg]:w-3.5 ${
        open ? "bg-[var(--terminal-header-hover)] text-[var(--terminal-tab-active)]" : "text-[var(--terminal-header-text)]"
      }`}
    >
      <PlusIcon />
    </button>
  );
}
