import { GithubLink } from "@/components/github-link";
import { HeroDownload } from "@/components/home/hero-download";

export default function Cta() {
  return (
    <section id="download" className="scroll-mt-20 py-20 sm:py-24 text-center">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 dark:from-white dark:via-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
          The Mac mini does the hours.
          <br className="hidden sm:block" /> Your laptop comes and goes.
        </h2>
        <p className="mt-6 text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
          Download lpm for both Macs, pair them from + → Another computer, and
          let Claude Code and Codex work on the one that stays home.
        </p>

        <div className="mt-10 flex justify-center">
          <HeroDownload source="mac-mini-cta" />
        </div>

        <div className="mt-8">
          <GithubLink
            source="mac-mini-cta"
            className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            View the open-source project
          </GithubLink>
        </div>
      </div>
    </section>
  );
}
