import Link from "next/link";
import { Check, ChevronDown, X } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { WORKTREE_ALTERNATIVE_PATH } from "@/lib/links";

type Gap = {
  missing: string;
  title: string;
  seen: string;
  symptom: string;
  symptomIsCode?: boolean;
  why: string;
  worktreeFix: string;
  fix: string;
  fixed: boolean;
};

const GAPS: Gap[] = [
  {
    missing: ".env and other ignored files",
    title: "Your .env and other ignored files are gone",
    seen: "Every environment variable is undefined",
    symptom:
      "The agent starts, the app boots, and every environment variable is undefined.",
    why: "git worktree add checks out tracked files only. Anything in .gitignore — .env, .env.local, local certificates, editor settings — was never in the commit, so it is never in the worktree.",
    worktreeFix: "List them in .worktreeinclude, or copy them by hand",
    fix: "Claude Code and Codex both read a .worktreeinclude file and copy the gitignored files that match it into the worktrees they create. For everything else you copy them yourself, or start from a copy of the project instead of a checkout.",
    fixed: true,
  },
  {
    missing: "node_modules",
    title: "node_modules is empty in every new worktree",
    seen: "A full install per agent before any work starts",
    symptom:
      "A full install per agent, and another copy of every package on disk, before any work starts.",
    why: "Dependencies are ignored files too. A fresh checkout has none of them, and symlinking one shared directory breaks resolution in tools that walk the real path.",
    worktreeFix: "Install per worktree, with a setup script",
    fix: "Install per worktree and accept the cost, with a setup script if your agent runs one, or duplicate the project so the already-installed dependencies come with it.",
    fixed: true,
  },
  {
    missing: "Your work in progress",
    title: "The work in progress on your desk does not come along",
    seen: "The agent starts from a commit you moved past",
    symptom:
      "You ask an agent to continue what you were doing, and it starts from a commit you moved past hours ago.",
    why: "A worktree branches from a commit. Claude Code branches from your default branch by default, or from local HEAD when worktree.baseRef is set to head. Neither reproduces uncommitted edits or untracked files.",
    worktreeFix: "Commit or stash first",
    fix: "Commit or stash first, or copy the working project rather than checking one out.",
    fixed: true,
  },
  {
    missing: "The same branch twice",
    title: "Two agents cannot try the same branch",
    seen: "fatal: 'main' is already checked out",
    symptom: "fatal: 'main' is already checked out at '/path/to/repo'",
    symptomIsCode: true,
    why: "Linked worktrees share one repository, and Git refuses to check out a branch in two of them — a commit in one would leave the other pointing at a stale state of the same branch.",
    worktreeFix: "One branch per agent",
    fix: "Give each agent its own branch, or give each one an independent repository so the restriction no longer applies.",
    fixed: true,
  },
  {
    missing: "Ports, databases, Docker volumes",
    title: "Ports, databases, and Docker volumes are still shared",
    seen: "The second dev server can't bind its port",
    symptom:
      "The second dev server cannot bind. Two agents run migrations against one database and corrupt each other's fixtures.",
    why: "Every isolation model on this page draws its boundary at the filesystem. Nothing about a separate directory reserves a port, namespaces a Postgres schema, or forks a Docker volume.",
    worktreeFix: "Per-copy config, separate services or containers",
    fix: "No worktree model solves this, and lpm does not either. What lpm does is catch it: it checks declared ports before a project starts, tells you which process is holding one, and can free it or stop the start. Real runtime isolation still means per-copy configuration, separate services, or containers.",
    fixed: false,
  },
];

const COLUMNS =
  "md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_7.5rem_1rem]";
const HEAD =
  "py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400";
const CELL_LABEL =
  "text-[11px] font-semibold uppercase tracking-widest text-gray-400 md:sr-only dark:text-gray-500";

export default function WhatBreaks() {
  return (
    <section id="gaps" className="scroll-mt-20 py-20 sm:py-24">
      <div className="max-w-4xl mx-auto px-6">
        <SectionHeader
          eyebrow="Before you fan out"
          title="Five things a Git worktree does not carry"
          description="Creating the worktree is one command. These are the five reasons the agent inside it still cannot run your project."
          className="mb-12"
        />

        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
          <div
            aria-hidden="true"
            className={`hidden gap-4 border-b border-gray-200 bg-gray-50 px-5 md:grid dark:border-gray-800 dark:bg-white/[0.03] ${COLUMNS}`}
          >
            <div className={HEAD}>What’s missing</div>
            <div className={HEAD}>What you see</div>
            <div className={HEAD}>Fix in a worktree</div>
            <div className={HEAD}>In a copy</div>
          </div>
          <ol className="divide-y divide-gray-100 dark:divide-gray-800">
            {GAPS.map((gap) => (
              <li key={gap.title}>
                <details className="group">
                  <summary
                    className={`grid cursor-pointer list-none gap-x-4 gap-y-2 px-5 py-4 text-sm transition-colors hover:bg-gray-50/70 md:items-start dark:hover:bg-white/[0.02] [&::-webkit-details-marker]:hidden ${COLUMNS}`}
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      <span className="sr-only">{gap.title}: </span>
                      <span aria-hidden="true">{gap.missing}</span>
                    </h3>
                    <p className="leading-relaxed text-gray-600 dark:text-gray-400">
                      <span className={CELL_LABEL}>What you see </span>
                      {gap.symptomIsCode ? (
                        <code className="font-mono text-[0.85em]">{gap.seen}</code>
                      ) : (
                        gap.seen
                      )}
                    </p>
                    <p className="leading-relaxed text-gray-600 dark:text-gray-400">
                      <span className={CELL_LABEL}>Fix in a worktree </span>
                      {gap.worktreeFix}
                    </p>
                    <p
                      className={`flex items-start gap-1.5 font-medium ${
                        gap.fixed
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      <span className={CELL_LABEL}>In a copy </span>
                      {gap.fixed ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      {gap.fixed ? "Comes along" : "Still shared"}
                    </p>
                    <ChevronDown
                      className="mt-0.5 hidden h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 md:block"
                      aria-hidden="true"
                    />
                  </summary>
                  <dl className="grid gap-4 bg-gray-50/70 px-5 py-4 text-sm sm:grid-cols-2 dark:bg-white/[0.02]">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                        Why
                      </dt>
                      <dd className="mt-1.5 leading-relaxed text-gray-600 dark:text-gray-400">
                        {gap.symptomIsCode ? (
                          <code className="mb-2 block font-mono text-[0.85em]">
                            {gap.symptom}
                          </code>
                        ) : (
                          <span className="mb-2 block">{gap.symptom}</span>
                        )}
                        {gap.why}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                        {gap.fixed ? "What fixes it" : "Where this stands"}
                      </dt>
                      <dd className="mt-1.5 leading-relaxed text-gray-700 dark:text-gray-300">
                        {gap.fix}
                      </dd>
                    </div>
                  </dl>
                </details>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-8 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          The first four go away when you{" "}
          <Link
            href={WORKTREE_ALTERNATIVE_PATH}
            className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 dark:text-gray-100 dark:decoration-gray-700 dark:hover:decoration-gray-100"
          >
            copy the whole project instead of a worktree
          </Link>
          : your .env, installed dependencies, and uncommitted work come along
          by default, and the copy has its own repository, so it can stay on
          a branch that is checked out elsewhere. The fifth holds for copies
          too.
        </p>
      </div>
    </section>
  );
}
