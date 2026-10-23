"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, Check } from "lucide-react";
import type { AgentState } from "./before-after-project-row";
import { ROWS } from "./before-after-sidebar";

const PILL =
  "inline-flex h-6 cursor-pointer items-center gap-[5px] rounded-full border px-2.5 text-xs font-medium transition-[border-color,background-color,box-shadow] duration-150";

const PILL_TONE: Record<AgentState, { idle: string; on: string }> = {
  waiting: {
    idle: "border-gray-200 text-amber-700 dark:border-white/10 dark:text-amber-400",
    on: "border-amber-500 bg-amber-50 text-amber-700 shadow-[0_0_0_3px_rgba(245,158,11,0.2)] dark:bg-amber-400/10 dark:text-amber-300",
  },
  working: {
    idle: "border-gray-200 dark:border-white/10",
    on: "border-violet-500 bg-violet-50 shadow-[0_0_0_3px_rgba(139,92,246,0.2)] dark:bg-violet-400/10",
  },
  done: {
    idle: "border-gray-200 text-blue-600 dark:border-white/10 dark:text-blue-400",
    on: "border-blue-500 bg-blue-50 text-blue-600 shadow-[0_0_0_3px_rgba(59,130,246,0.2)] dark:bg-blue-400/10 dark:text-blue-300",
  },
};

const CLI_NAME: Record<string, string> = { claude: "Claude", codex: "Codex" };

function describe(state: AgentState): string {
  const row = ROWS.find((r) => r.agent?.state === state);
  if (!row?.agent) return "";
  const cli = CLI_NAME[row.agent.name] ?? row.agent.name;
  const what = {
    waiting: `${cli} asks to run npm run db:migrate`,
    working: `${cli} has been working for ${row.agent.elapsed}`,
    done: `${cli} finished in ${row.agent.elapsed}`,
  }[state];
  return `${row.name}: ${what}`;
}

const CHIPS: { state: AgentState; label: ReactNode }[] = [
  {
    state: "waiting",
    label: (
      <>
        <Bell aria-hidden="true" className="h-3 w-3" strokeWidth={2.25} />
        Needs you
      </>
    ),
  },
  {
    state: "working",
    label: (
      <span className="bg-[linear-gradient(90deg,#2563eb,#7c3aed_55%,#be185d)] bg-clip-text text-transparent dark:bg-[linear-gradient(90deg,#60a5fa,#a78bfa_55%,#f472b6)]">
        Working
      </span>
    ),
  },
  {
    state: "done",
    label: (
      <>
        <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
        Done
      </>
    ),
  },
];

// The three states an agent row shows in the sidebar, named in the app's own
// colours. Pointing at one rings its rows in the lpm window above; a click or
// tap keeps the rings up, and `onPick` lets the phone's switch show that window.
export function StateLegend({ onPick }: { onPick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<AgentState | null>(null);
  const [pinned, setPinned] = useState<AgentState | null>(null);
  const active = hovered ?? pinned;

  useEffect(() => {
    const scope = ref.current?.closest<HTMLElement>("[data-state-scope]");
    if (!scope) return;
    if (active) scope.dataset.highlight = active;
    else delete scope.dataset.highlight;
  }, [active]);

  const pick = (state: AgentState) => {
    const next = pinned === state ? null : state;
    setPinned(next);
    if (next) onPick?.();
  };

  return (
    <div ref={ref}>
      <p className="flex flex-wrap justify-center gap-1.5">
        {CHIPS.map(({ state, label }) => (
          <span key={state} className="relative">
            <button
              type="button"
              aria-pressed={pinned === state}
              aria-describedby={
                active === state ? `ba-tip-${state}` : undefined
              }
              onClick={() => pick(state)}
              onPointerEnter={(e) =>
                e.pointerType === "mouse" && setHovered(state)
              }
              onPointerLeave={() => setHovered(null)}
              onFocus={(e) =>
                e.currentTarget.matches(":focus-visible") && setHovered(state)
              }
              onBlur={() => setHovered(null)}
              className={`${PILL} ${active === state ? PILL_TONE[state].on : PILL_TONE[state].idle}`}
            >
              {label}
            </button>
            {active === state && (
              <span
                id={`ba-tip-${state}`}
                role="tooltip"
                className="pointer-events-none absolute top-full left-1/2 z-10 mt-2.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-[12.5px] font-medium text-white shadow-lg md:block dark:bg-white dark:text-gray-900"
              >
                {describe(state)}
              </span>
            )}
          </span>
        ))}
      </p>
      {active && (
        <p className="mt-2.5 text-center text-[12.5px] text-gray-600 md:hidden dark:text-gray-400">
          {describe(active)}
        </p>
      )}
    </div>
  );
}
