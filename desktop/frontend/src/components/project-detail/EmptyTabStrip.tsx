import { TabStripPlus } from "../terminal/TabStripPlus";

interface EmptyTabStripProps {
  onNewTerminal: () => void;
  // Puts the keyboard in the launcher under the strip.
  onPick: () => void;
}

// The running pane's tab strip before its first tab, so a terminal or agent
// started here lands as a tab and nothing around it moves. + keeps its click
// (a terminal, or the pick with "Pick agent and model on +"), but the pick is
// the launcher already on the page rather than a popup over it.
export function EmptyTabStrip({ onNewTerminal, onPick }: EmptyTabStripProps) {
  return (
    <div className="flex items-center gap-0.5 border-b-1 border-b-[var(--terminal-header-hover)] bg-[var(--terminal-header)] px-2 py-1">
      <TabStripPlus onAdd={onNewTerminal} onPick={onPick} />
    </div>
  );
}
