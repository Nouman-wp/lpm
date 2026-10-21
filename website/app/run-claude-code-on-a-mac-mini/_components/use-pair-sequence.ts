"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export type PairStep =
  | "idle"
  | "press"
  | "waiting"
  | "accept"
  | "connected"
  | "running";

const NEXT: Record<PairStep, { step: PairStep; after: number }> = {
  idle: { step: "press", after: 1300 },
  press: { step: "waiting", after: 450 },
  waiting: { step: "accept", after: 2800 },
  accept: { step: "connected", after: 650 },
  connected: { step: "running", after: 2200 },
  running: { step: "idle", after: 6400 },
};

// The reduced-motion view is derived, never written: it shows Claude Code and
// Codex running on the paired Mac mini, and the loop never starts.
export function usePairSequence(active: boolean) {
  const [step, setStep] = useState<PairStep>("idle");
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active || reduced) return;
    const { step: next, after } = NEXT[step];
    const t = setTimeout(() => setStep(next), after);
    return () => clearTimeout(t);
  }, [active, reduced, step]);

  return { step: reduced ? ("running" as PairStep) : step, reduced };
}
