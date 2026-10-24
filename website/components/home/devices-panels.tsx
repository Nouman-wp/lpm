import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PairDemoCard } from "@/app/run-claude-code-on-a-mac-mini/_components/pair-demo";
import { AddHostCard } from "@/app/run-claude-code-on-a-remote-server/_components/add-host-demo";
import { LINUX_HOST_PATH, MAC_MINI_PATH } from "@/lib/links";

const MORE =
  "inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900 hover:decoration-current dark:text-gray-300 dark:decoration-gray-600 dark:hover:text-white";

function More({ href, children }: { href: string; children: string }) {
  return (
    <p className="mt-6 text-center">
      <Link href={href} className={MORE}>
        {children}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </p>
  );
}

export function ComputerPanel({ active }: { active: boolean }) {
  return (
    <div className="mx-auto max-w-5xl">
      <PairDemoCard active={active} />
      <More href={MAC_MINI_PATH}>Run Claude Code and Codex on a Mac mini</More>
    </div>
  );
}

export function ServerPanel({ active }: { active: boolean }) {
  return (
    <div className="mx-auto max-w-3xl">
      <AddHostCard active={active} />
      <More href={LINUX_HOST_PATH}>Run Claude Code on a remote server</More>
    </div>
  );
}
