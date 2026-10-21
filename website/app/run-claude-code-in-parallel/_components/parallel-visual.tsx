import ParallelWindow from "./parallel-window";

const LEGEND = [
  "Copies and worktrees get their own sidebar row, with what their agent is doing and for how long.",
  "Run in duplicates sends one prompt to as many as 10 copies at once, so you can keep the best result.",
  "Two agents can also share one project, split side by side in the same window.",
];

export default function ParallelVisual() {
  return (
    <section className="pb-2">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <p className="sr-only">
          An illustration of one lpm window with five coding agents at once. The
          selected project, shop-api, is split into two panes: Claude Code is
          working on a login rate limit, and Codex is waiting for approval to
          run a command. The sidebar lists shop-api with two copies and a Git
          worktree beneath it, each with its own agent marked working, done or
          problem and how long it has been at it. The prompt box under Claude
          Code has its send menu open on Run in duplicates, set to three runs.
        </p>

        <ParallelWindow />

        <ol className="mx-auto mt-5 grid max-w-4xl gap-4 text-left sm:grid-cols-3 sm:gap-6">
          {LEGEND.map((text, i) => (
            <li
              key={text}
              className="flex gap-2.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-bold text-white dark:bg-white dark:text-gray-900">
                {i + 1}
              </span>
              {text}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
