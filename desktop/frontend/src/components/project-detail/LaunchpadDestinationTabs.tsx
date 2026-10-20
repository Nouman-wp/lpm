import type { LaunchpadTab } from "../../launchpadAgentActions";
import { TerminalIcon } from "../icons";
import { AgentGlyph } from "../terminal/AgentGlyph";
import { LaunchpadGroupTab } from "./LaunchpadGroupTab";
import { launchpadTabClass } from "./launchpadTabStyle";

// Where the launchpad's prompt goes, picked at the top of its box: a terminal
// that runs what's typed, or an agent.
export function LaunchpadDestinationTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: LaunchpadTab[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Start in" className="flex flex-wrap items-center gap-1 px-2 pt-2">
      <button
        type="button"
        role="radio"
        aria-checked={value === "terminal"}
        // A click leaves the keyboard in the prompt.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange("terminal")}
        className={`${launchpadTabClass(value === "terminal")} px-2.5`}
      >
        <TerminalIcon />
        Terminal
      </button>
      {tabs.length > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-[var(--border)]" />}
      {tabs.map((tab) => {
        if (tab.options.length > 1) return <LaunchpadGroupTab key={tab.key} tab={tab} value={value} onChange={onChange} />;
        const [option] = tab.options;
        return (
          <button
            key={tab.key}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(option.id)}
            className={`${launchpadTabClass(value === option.id)} px-2.5`}
          >
            <AgentGlyph agent={option.agent} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
