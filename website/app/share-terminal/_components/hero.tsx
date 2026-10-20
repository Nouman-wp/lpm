import { GithubLink } from "@/components/github-link";
import { HeroDownload } from "@/components/home/hero-download";

const CHIPS = [
  "nothing to install for them",
  "you let each person in",
  "view only until you allow typing",
  "encrypted end to end",
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-[clamp(4.5rem,9.5vh,6.5rem)] pb-[clamp(1.25rem,3vh,2rem)] text-center">
      <div className="absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_28%)]" />
      <div className="max-w-4xl mx-auto px-6">
        <p className="mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-emerald-700/80 dark:text-emerald-300/80">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live tab sharing
        </p>
        <h1 className="text-[2.25rem] sm:text-5xl md:text-[clamp(2.75rem,6.2vh,3.75rem)] font-extrabold tracking-tight leading-[1.06] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 dark:from-white dark:via-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
          Share your terminal with anyone, live in their browser.
        </h1>
        <p className="mt-5 text-base sm:text-[17px] text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
          Send a link to one terminal tab: a shell, a build, or Claude Code
          and Codex at work. A teammate, a reviewer or a client opens it and
          follows along as it happens, with nothing to install. You let each
          person in, and they type only when you say so.
        </p>

        <ul className="mt-[clamp(1rem,2vh,1.5rem)] flex flex-wrap justify-center gap-3 text-xs font-medium text-gray-600 dark:text-gray-300">
          {CHIPS.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 shadow-sm dark:border-gray-800 dark:bg-white/[0.04]"
            >
              {chip}
            </li>
          ))}
        </ul>

        <div className="mt-[clamp(1.25rem,3vh,1.75rem)] flex justify-center">
          <HeroDownload source="share-hero" />
        </div>

        <div className="mt-[clamp(1rem,2vh,1.5rem)]">
          <GithubLink
            source="share-hero"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
          />
        </div>
      </div>
    </section>
  );
}
