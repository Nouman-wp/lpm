import { Columns2, KeyRound, SquareTerminal, UserCog } from "lucide-react";
import { SectionHeader } from "@/components/section-header";

const FEATURES = [
  {
    icon: SquareTerminal,
    title: "Start them in a Mac mini project",
    body: "Open the project from your sidebar and start Claude Code or Codex in a tab, the way you would in a local one. The process belongs to the Mac mini, not to your laptop.",
  },
  {
    icon: KeyRound,
    title: "The Mac mini's sign-ins",
    body: "Sessions use the Claude Code and Codex installed and signed in on the Mac mini, so its accounts do the work and spend their usage limits. Your laptop's sign-ins stay out of it.",
  },
  {
    icon: UserCog,
    title: "Its Claude accounts, from your laptop",
    body: "Right-click the Mac mini in your sidebar and choose Settings on Mac mini… to add its Claude accounts or sign one in. The sign-in runs in a terminal on the Mac mini that you type into from here.",
  },
  {
    icon: Columns2,
    title: "Several at once, on its cores",
    body: "Run Claude Code in one tab and Codex in another, across the Mac mini's projects, or split a tab to watch two side by side. Their builds and tests use the Mac mini's CPU, not your laptop's.",
  },
];

export default function Sessions() {
  return (
    <section className="py-20 sm:py-24 bg-gray-50/60 dark:bg-white/[0.02]">
      <div className="max-w-4xl mx-auto px-6">
        <SectionHeader
          eyebrow="Starting a session"
          title="Start Claude Code and Codex on the Mac mini from your laptop"
          description="A Mac mini project opens in the same window as your local ones. The sessions you start there run on the Mac mini, and you type into them from here."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-transparent"
            >
              <Icon
                className="h-5 w-5 text-gray-500 dark:text-gray-400"
                aria-hidden
              />
              <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {body}
              </p>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          To check what they built, the review pane shows the Mac mini&rsquo;s
          changes, and its dev servers open on your laptop&rsquo;s localhost.
        </p>
      </div>
    </section>
  );
}
