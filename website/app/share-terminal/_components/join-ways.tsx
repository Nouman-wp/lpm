import { Check, Globe, Laptop } from "lucide-react";
import { SectionHeader } from "@/components/section-header";

const WAYS = [
  {
    icon: Globe,
    title: "In any browser",
    tag: "Nothing to install",
    points: [
      "A link and a browser are enough, on a laptop or a phone.",
      "Works from anywhere: no shared network, no ports to open.",
      "A prompt box with Esc, the arrows, Tab, Return and Ctrl C, for answering whatever the terminal asks.",
      "Encrypted end to end between their browser and your computer, through lpm's relay.",
    ],
  },
  {
    icon: Laptop,
    title: "In lpm",
    tag: "For teammates who use it",
    points: [
      "The link opens lpm with the invite filled in, so joining is one click.",
      "The tab shows up under Shared with me in their sidebar.",
      "The same prompt box they use in their own terminals.",
      "Connects straight to your computer, on the same network or over Tailscale, encrypted and pinned to it.",
    ],
  },
];

export default function JoinWays() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-6">
        <SectionHeader
          eyebrow="Two ways in"
          title="One link. They pick how to open it."
          description="The invite opens a page on lpm.cx with both choices. Either way, they see your tab at your size, and you decide who gets in."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {WAYS.map(({ icon: Icon, title, tag, points }) => (
            <div
              key={title}
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-[#151515]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-5 w-5 text-gray-700 dark:text-gray-200" aria-hidden />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                  </h3>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800/70 dark:text-gray-300">
                  {tag}
                </span>
              </div>
              <ul className="mt-5 space-y-3">
                {points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
