import { AGENT_COUNT, SERVICE_COUNT, WINDOWS } from "./before-after-data";

// Both sides are counted in the same units: the same services and agents, in
// one window per process or in one window.
export const WINDOW_COUNT = { before: `${WINDOWS.length} windows`, after: "1 window" };

export function CountLine({ side }: { side: keyof typeof WINDOW_COUNT }) {
  return (
    <span className="font-mono text-[12.5px] leading-[1.4] tracking-tight tabular-nums text-gray-500 dark:text-gray-400">
      <b className="font-semibold text-gray-900 dark:text-white">{WINDOW_COUNT[side]}</b>
      {` · ${SERVICE_COUNT} services · ${AGENT_COUNT} agents`}
    </span>
  );
}
