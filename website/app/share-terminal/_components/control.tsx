import Image from "next/image";
import { DoorOpen, Eye, Smile, UserMinus, UserRoundCheck } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import promptCanType from "../_assets/prompt-can-type.jpg";
import promptViewOnly from "../_assets/prompt-view-only.jpg";

const CONTROLS = [
  {
    icon: UserRoundCheck,
    title: "Every person needs your OK",
    body: "The link alone gets nobody in. Each person asks to join under their name, and lpm asks you: Let in or Deny. Requests you don't answer lapse after two minutes.",
  },
  {
    icon: Smile,
    title: "Check it's really them",
    body: "Someone joining from a browser sees four emoji, and so do you. Not sure the link reached the right person? Ask which ones they see.",
  },
  {
    icon: Eye,
    title: "View only until you say so",
    body: "Guests start out watching. Switch Guests to Can type and lpm reminds you that anyone you let in can now run commands on your computer from this tab.",
  },
  {
    icon: UserMinus,
    title: "Remove one person, or everyone",
    body: "Share tab lists everyone you let in and whether they're watching. Remove ends one person's view; Stop sharing ends it for all of them at once.",
  },
  {
    icon: DoorOpen,
    title: "Nothing outlives lpm",
    body: "Shares end when you quit lpm. A guest can Leave at any time, and a dropped connection on their side picks back up on its own.",
  },
];

const PROMPTS = [
  {
    label: "View only",
    image: promptViewOnly,
    alt: "A shared tab's prompt box in the browser, dimmed, with a label saying the host hasn't let you type",
  },
  {
    label: "Can type",
    image: promptCanType,
    alt: "The same prompt box after the host allows typing, with a guest's question typed in and the send button lit",
  },
];

export default function Control() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-6">
        <SectionHeader
          eyebrow="You stay in charge"
          title="It's your terminal. Guests get exactly what you give them."
          description="Sharing a terminal is sharing a shell on your computer, so every step is opt-in and you can take it back in one click."
        />
        <div className="grid items-start gap-10 lg:grid-cols-5">
          <ul className="space-y-6 lg:col-span-3">
            {CONTROLS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="space-y-5 lg:col-span-2 lg:sticky lg:top-24">
            {PROMPTS.map(({ label, image, alt }) => (
              <figure key={label}>
                <figcaption className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  {label}
                </figcaption>
                <div className="overflow-hidden rounded-xl border border-black/10 bg-black shadow-xl shadow-black/15 dark:border-white/10">
                  <Image
                    src={image}
                    alt={alt}
                    placeholder="blur"
                    quality={90}
                    sizes="(max-width: 1024px) 100vw, 384px"
                    className="h-auto w-full"
                  />
                </div>
              </figure>
            ))}
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              The guest&rsquo;s prompt box in a browser. It stays in place while
              typing is off, so nothing jumps when you switch it on.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
