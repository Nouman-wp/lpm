import { SectionHeader } from "@/components/section-header";

const CASES = [
  {
    who: "Pair programming",
    title: "Work in one terminal together",
    body: "You type, they suggest the next command, or hand them the keyboard for a minute. Both of you read the same output as it scrolls, at the same size.",
  },
  {
    who: "AI coding agents",
    title: "Drive Claude Code or Codex together",
    body: "Share the tab an agent runs in. A teammate watches what it is about to do, weighs in before you approve a migration, or types the next prompt themselves.",
  },
  {
    who: "Debugging",
    title: "See the actual error, not a screenshot of it",
    body: "When someone's build keeps failing, have them share the tab. You read the real output, scroll back to where it went wrong and, if they let you, type the fix.",
  },
  {
    who: "Onboarding and demos",
    title: "Walk someone through it live",
    body: "Show a new teammate how the project starts, or a client how the build runs. Leave Guests on View only and they follow from their browser, with nothing to install.",
  },
];

export default function UseCases() {
  return (
    <section className="py-16 sm:py-20 bg-gray-50/60 dark:bg-white/[0.015]">
      <div className="max-w-5xl mx-auto px-6">
        <SectionHeader
          eyebrow="What people share"
          title="When someone else should see what's in your terminal"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {CASES.map(({ who, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-[#151515]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                {who}
              </p>
              <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
