import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import { LINUX_HOST_PATH } from "@/lib/links";

const OPTIONS = [
  {
    name: "A Mac mini, or any Mac or PC",
    accent: true,
    rows: [
      ["Setup", "Install the lpm app on it, then pair from + → Another computer."],
      ["Connection", "Direct, on port 8766, over your network or Tailscale."],
      ["After a restart", "lpm opens again from Login Items once the Mac is logged in."],
      ["Sleep", "Keep it plugged in, with Keep this Mac awake on."],
      ["Hardware", "The Mac you already have, Apple silicon included."],
      ["Its screen", "A desktop you can sit at: the Claude Code and Codex tabs you start from your laptop show there too."],
    ],
  },
  {
    name: "A Linux server",
    accent: false,
    rows: [
      ["Setup", "Type what you would type after ssh, and lpm installs and pairs itself."],
      ["Connection", "Through an SSH tunnel lpm keeps up, so nothing new is exposed."],
      ["After a restart", "On a systemd server, lpm starts on boot as a service."],
      ["Sleep", "A server doesn't sleep."],
      ["Hardware", "Ubuntu 22.04 or newer, or Debian, on x86_64. ARM isn't supported yet."],
      ["Its screen", "None: lpm runs there without one, driven from your laptop."],
    ],
  },
];

export default function Compare() {
  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-5xl mx-auto px-6">
        <SectionHeader
          eyebrow="Choosing a machine"
          title="Mac mini or Linux server?"
          description="Both keep Claude Code and Codex working after your laptop leaves. They differ in how you set them up and what brings them back."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {OPTIONS.map(({ name, accent, rows }) => (
            <article
              key={name}
              className={`rounded-2xl border p-6 sm:p-7 ${
                accent
                  ? "border-emerald-200 bg-emerald-50/35 dark:border-emerald-900/60 dark:bg-emerald-400/[0.045]"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {name}
              </h3>
              <dl className="mt-4 space-y-3">
                {rows.map(([label, body]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {body}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Already own a Mac that stays home? Start there. Renting a box
          instead? Here is how to{" "}
          <Link
            href={LINUX_HOST_PATH}
            className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 dark:text-gray-100 dark:decoration-gray-700 dark:hover:decoration-gray-100"
          >
            run Claude Code and Codex on a Linux server
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
