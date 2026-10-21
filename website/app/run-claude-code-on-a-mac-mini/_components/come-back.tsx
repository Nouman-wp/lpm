import { SectionHeader } from "@/components/section-header";

const STEPS = [
  {
    when: "You start a run",
    body: "Give Claude Code or Codex a task in a Mac mini project. The process belongs to lpm on the Mac mini, not to your laptop or its Wi-Fi.",
  },
  {
    when: "You close the lid",
    body: "Close it, quit lpm, or lose the connection. Only the link goes. The Mac mini keeps both sessions running and keeps their recent output.",
  },
  {
    when: "One finishes or needs you",
    body: "While your laptop is connected, the chime and the banner go to it, the Mac you used last. With the laptop shut, lpm Link on your iPhone can tell you instead.",
  },
  {
    when: "You come back",
    body: "lpm reconnects on its own. The sidebar shows each session as Done with how long it worked, or as Needs you, and each tab carries on from where you left it, the answer already in it.",
  },
];

export default function ComeBack() {
  return (
    <section id="come-back" className="scroll-mt-20 py-20 sm:py-24">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeader
          eyebrow="Leaving and coming back"
          title="Close the laptop. Claude Code and Codex keep working."
          description="The sessions run on the Mac mini, so your laptop leaving ends a connection, not a run."
        />
        <ol className="relative space-y-8 border-l border-gray-200 pl-8 dark:border-gray-800">
          {STEPS.map(({ when, body }) => (
            <li key={when} className="relative">
              <span className="absolute -left-[38.5px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-[#111]" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {when}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {body}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-10 rounded-2xl border border-gray-200 p-5 text-sm leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-400">
          Two limits worth knowing. A session that printed more than 512 KB
          while you were gone, or one you come back to after quitting lpm on
          the laptop, reopens with its recent output on a fresh screen rather
          than every line. And the Mac mini itself has to stay awake with lpm
          open:{" "}
          <a
            href="#setup"
            className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 dark:text-gray-100 dark:decoration-gray-700 dark:hover:decoration-gray-100"
          >
            set it up once
          </a>
          .
        </p>
      </div>
    </section>
  );
}
