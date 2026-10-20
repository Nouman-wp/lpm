import { Keyboard, MonitorSmartphone, ScrollText, Zap } from "lucide-react";
import { SectionHeader } from "@/components/section-header";

const REASONS = [
  {
    icon: ScrollText,
    title: "Text, not a video of text",
    body: "They read the real terminal, sharp at any size. They can scroll back through what ran before they joined and copy a command or a path straight out of it.",
  },
  {
    icon: Zap,
    title: "Live, not a pasted snapshot",
    body: "A pasted log shows where the session was. A shared tab shows where it is: a build scrolling, a test failing, an agent stopping to ask a question.",
  },
  {
    icon: Keyboard,
    title: "One tab, not your whole screen",
    body: "Guests see that single terminal. Not your other tabs, your other projects, your files or the notification that just popped up, and they never steer your mouse.",
  },
  {
    icon: MonitorSmartphone,
    title: "Nothing to set up on their side",
    body: "No app, no account, no SSH key. A link and a browser are enough, on a laptop or a phone. If they do use lpm, the same link opens it instead.",
  },
];

export default function Why() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-6">
        <SectionHeader
          eyebrow="Why not just share your screen?"
          title="A call shows them pixels. A shared tab hands them the session."
          description="Working through something in a terminal means reading long output, catching the prompt that asks a question, and sometimes typing the answer yourself. Screen sharing was built for slides."
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {REASONS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800/70 dark:text-gray-200">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
