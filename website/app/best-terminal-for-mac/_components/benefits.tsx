import { Check, X } from "lucide-react";
import { SectionHeader } from "@/components/section-header";

type Change = {
  before: string;
  after: string;
};

const CHANGES: Change[] = [
  {
    before:
      "Ten terminal commands to bring up the API, worker, database and frontend",
    after: "Open the project and press Start. Every service is live in one window",
  },
  {
    before: "Switching repos means stopping servers and losing scrollback",
    after:
      "The first project keeps running in the background, logs and history intact",
  },
  {
    before: "Guessing which iTerm2 tab has the migration running",
    after: "Every running service has its own labeled pane",
  },
  {
    before: "Electron-based terminals bundle their own Chromium runtime",
    after:
      "lpm uses the webview macOS already provides, native on Apple Silicon and Intel",
  },
];

const LABEL =
  "px-5 py-3 text-[11px] font-semibold uppercase tracking-widest";

export default function Benefits() {
  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeader
          eyebrow="Why developers switch"
          title="What changes when you stop fighting your terminal"
          description="The first hour, before and after."
        />
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
          <div
            aria-hidden="true"
            className="hidden grid-cols-2 border-b border-gray-200 bg-gray-50 sm:grid dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <div className={`${LABEL} text-gray-500 dark:text-gray-400`}>
              Before lpm
            </div>
            <div
              className={`${LABEL} border-l border-gray-200 text-gray-900 dark:border-gray-800 dark:text-gray-100`}
            >
              With lpm
            </div>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800/70">
            {CHANGES.map(({ before, after }) => (
              <li key={after} className="grid sm:grid-cols-2">
                <p className="flex gap-3 px-5 pt-4 pb-2 text-sm leading-relaxed text-gray-500 sm:py-4 dark:text-gray-400">
                  <X
                    className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="sr-only">Before lpm: </span>
                    {before}
                  </span>
                </p>
                <p className="flex gap-3 px-5 pt-2 pb-4 text-sm font-medium leading-relaxed text-gray-900 sm:border-l sm:border-gray-200 sm:py-4 dark:text-gray-100 sm:dark:border-gray-800">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-gray-900 dark:text-gray-100"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="sr-only">With lpm: </span>
                    {after}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
