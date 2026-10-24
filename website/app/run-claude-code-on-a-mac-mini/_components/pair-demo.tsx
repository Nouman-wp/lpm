"use client";

import { useInView } from "@/components/config/playground/hooks";
import { PairDemoLaptop } from "./pair-demo-laptop";
import { PairDemoMini } from "./pair-demo-mini";
import { BORDER, HOST_NAME, LAPTOP_NAME, MUTED } from "./pair-demo-styles";
import { PairDemoWindow } from "./pair-demo-window";
import { usePairSequence } from "./use-pair-sequence";

// The card alone, for the home page's "Another computer" tab, which keeps it
// mounted but still while another tab is showing.
export function PairDemoCard({ active = true }: { active?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { step, reduced } = usePairSequence(inView && active);

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-[#161616] p-4 shadow-2xl shadow-gray-200/60 sm:p-6 dark:border-[#2e2e2e] dark:shadow-black/40"
    >
      <p
        className={`mb-3 text-[11px] font-medium uppercase tracking-[0.15em] ${MUTED}`}
      >
        Pair once, then run Claude Code and Codex on the Mac mini
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <PairDemoWindow name={LAPTOP_NAME} role="Your laptop">
          <PairDemoLaptop step={step} />
        </PairDemoWindow>
        <PairDemoWindow name={HOST_NAME} role="Stays on">
          <PairDemoMini step={step} />
        </PairDemoWindow>
      </div>

      <div className={`mt-5 border-t ${BORDER} pt-4`}>
        <p className={`text-[12px] leading-relaxed ${MUTED}`}>
          {reduced
            ? "A laptop paired with a Mac mini: Claude Code and Codex run in one of the Mac mini's projects, and the laptop's sidebar shows both of them working."
            : "On your laptop, + → Another computer lists the Macs nearby. Click one and accept on the Mac mini once both screens show the same 6-digit code. Then start Claude Code and Codex in one of its projects: they run on the Mac mini, and your sidebar shows what each is doing."}
        </p>
        <p className={`mt-2 text-[12px] leading-relaxed ${MUTED}`}>
          {reduced
            ? "Pair from + → Another computer: pick the Mac mini nearby, paste a one-time invite from it, or type its address and code."
            : "Don't see it nearby? Paste a one-time invite from the Mac mini, or type its address and code."}
        </p>
      </div>
    </div>
  );
}

export default function PairDemo() {
  return (
    <section className="pb-4 sm:pb-8">
      <div className="max-w-5xl mx-auto px-6">
        <PairDemoCard />
      </div>
    </section>
  );
}
