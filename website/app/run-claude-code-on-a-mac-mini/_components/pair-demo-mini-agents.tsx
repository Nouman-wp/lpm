import { AGENTS, BORDER, GROUP, MUTED, PRIMARY, PROJECT } from "./pair-demo-styles";

const ACTIVITY = ["Running npm test -- checkout", "Editing src/routes/orders.ts"];

export function PairDemoMiniAgents() {
  return (
    <>
      <p className={`text-sm font-semibold ${PRIMARY}`}>{PROJECT}</p>
      <p className={`mt-0.5 text-[11px] leading-relaxed ${MUTED}`}>
        2 agents working on this Mac
      </p>

      <div className="mt-4 space-y-2.5">
        {AGENTS.map(({ glyph, color, name, task, elapsed }, i) => (
          <div key={name} className={GROUP}>
            <div
              className={`flex items-center gap-2 border-b ${BORDER} bg-[#1f1f1f] px-3.5 py-2 text-[12px]`}
            >
              <span style={{ color }} aria-hidden>
                {glyph}
              </span>
              <span className={`min-w-0 flex-1 truncate font-medium ${PRIMARY}`}>
                {name}
              </span>
              <span className={`shrink-0 text-[11px] ${PRIMARY} motion-safe:animate-pulse`}>
                Working
              </span>
              <span className={`shrink-0 text-[11px] tabular-nums ${MUTED}`}>
                {elapsed}
              </span>
            </div>
            <div className="space-y-1 bg-[#161616] px-3.5 py-2.5 font-mono text-[11px] leading-relaxed">
              <p className="truncate text-[#b3b3b3]">
                <span className={MUTED}>&gt; </span>
                {task}
              </p>
              <p className={`truncate ${MUTED}`}>
                <span style={{ color }}>●</span> {ACTIVITY[i]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
