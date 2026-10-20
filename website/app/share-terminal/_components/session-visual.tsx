import Image, { type StaticImageData } from "next/image";
import { Lock } from "lucide-react";
import sessionBrowser from "../_assets/session-browser.jpg";
import sessionLpm from "../_assets/session-lpm.jpg";

const SIDES: { label: string; image: StaticImageData; alt: string }[] = [
  {
    label: "Your computer, in lpm",
    image: sessionLpm,
    alt: "lpm with a Claude Code tab marked as shared: a question about checkout totals, Claude's answer, then a follow-up a guest typed and Claude's reply",
  },
  {
    label: "Their browser",
    image: sessionBrowser,
    alt: "The same Claude Code tab open in a browser, showing the same questions and answers, with a prompt box and Esc, arrow, Tab, Return and Ctrl C keys under it",
  },
];

export default function SessionVisual() {
  return (
    <section aria-label="One session, two screens" className="overflow-hidden px-4 pb-16 sm:px-6 sm:pb-20">
      <figure className="relative mx-auto max-w-6xl">
        <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_25%_30%,rgba(217,119,87,0.16),transparent_40%),radial-gradient(circle_at_75%_70%,rgba(14,165,233,0.14),transparent_40%)] blur-2xl" />
        <div className="relative grid gap-6 md:grid-cols-2 md:gap-8">
          {SIDES.map(({ label, image, alt }, i) => (
            <div key={label}>
              <p className="mb-2.5 text-center text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                {label}
              </p>
              <div className="overflow-hidden rounded-xl border border-black/10 bg-black shadow-2xl shadow-black/20 ring-1 ring-white/10 dark:border-white/10">
                <Image
                  src={image}
                  alt={alt}
                  placeholder="blur"
                  quality={90}
                  loading={i === 0 ? "eager" : undefined}
                  fetchPriority={i === 0 ? "high" : undefined}
                  sizes="(max-width: 768px) 100vw, 576px"
                  className="h-auto w-full"
                />
              </div>
            </div>
          ))}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 hidden -translate-x-1/2 -translate-y-1 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 shadow-sm md:flex dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <Lock className="h-3 w-3" />
            encrypted end to end
          </div>
        </div>
        <figcaption className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Here the shared tab runs Claude Code: the same moment on two
          screens. The follow-up about a discount code was typed in the
          browser, after the host switched the guest to Can type.
        </figcaption>
      </figure>
    </section>
  );
}
