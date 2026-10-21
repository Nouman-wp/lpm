import Link from "next/link";
import { LINUX_HOST_PATH } from "@/lib/links";

export default function QuickAnswer() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-6">
        <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-6 sm:p-8 dark:border-gray-800 dark:bg-white/[0.025]">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            The short answer
          </p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Can Claude Code and Codex run on a Mac mini while you use your
            laptop?
          </h2>
          <div className="mt-4 space-y-4 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400">
            <p>
              Yes. Claude Code and Codex are command-line tools, so they run on
              a Mac mini just as they do on your laptop, and there a long run
              doesn&rsquo;t end when you close the lid. The hard part is
              reaching them. Screen Sharing hands you a whole second desktop in
              a window. ssh and tmux hand you a shell that can&rsquo;t tell you
              which agent finished or which one is waiting on you.
            </p>
            <p>
              With lpm on both Macs, you pair them once from{" "}
              <strong className="font-medium text-gray-900 dark:text-gray-100">
                + → Another computer
              </strong>{" "}
              above your projects. The Mac mini&rsquo;s projects then sit in
              your laptop&rsquo;s sidebar. Open one and start Claude Code or
              Codex in a tab: the session runs on the Mac mini, with the CLIs
              and sign-ins installed there. Close the laptop, and when it
              reconnects, the sidebar shows each finished session as Done with
              how long it worked, and its answer is in the tab.
            </p>
            <p>
              Any Mac or PC running lpm can do this job. A Mac mini is the usual
              pick: it is small, quiet, and has no lid to close. If you would
              rather rent a machine than keep one at home,{" "}
              <Link
                href={LINUX_HOST_PATH}
                className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 dark:text-gray-100 dark:decoration-gray-700 dark:hover:decoration-gray-100"
              >
                run Claude Code and Codex on a Linux VPS
              </Link>{" "}
              instead.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
