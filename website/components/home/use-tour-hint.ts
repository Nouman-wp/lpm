"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Tour, TourHint } from "./tour";

type HintStage = "invite" | "next";

// The pill's line: the tour's opening one, then the one the last step to have
// happened carries. A tour that waits for the visitor has nothing to open
// with: its invite sits on the control instead.
export function useTourHint(tour: Tour | undefined) {
  const [hint, setHint] = useState<{
    text: TourHint | undefined;
    stage: HintStage;
  }>({ text: tour?.invite ? undefined : tour?.hint, stage: "invite" });
  // Visibility is held apart from the line so the pill keeps drawing the line
  // it was showing all the way through its half-second fade.
  const [visible, setVisible] = useState(true);
  const reachedRef = useRef(0);
  // Once any step has put its own line in the pill, the pill is theirs.
  const stepHintShownRef = useRef(false);

  const hide = useCallback(() => setVisible(false), []);

  // A step that has happened swaps the line for its own; one with nothing to
  // say retires the opening line once the tour is under way.
  const advance = useCallback(
    (stage: number) => {
      if (!tour) return;
      for (let i = reachedRef.current; i < stage; i += 1) {
        const next = tour.steps[i]?.hint;
        if (next) {
          stepHintShownRef.current = true;
          setHint({ text: next, stage: "next" });
          setVisible(true);
        } else if (i > 0 && !stepHintShownRef.current) {
          setVisible(false);
        }
      }
      reachedRef.current = Math.max(reachedRef.current, stage);
    },
    [tour],
  );

  return { hint, visible, hide, advance };
}

// A pill that never leaves reads as chrome rather than a prompt. The clock
// only runs while the pill is up in a frame parked in the viewport, so its
// whole life is not spent loading or under the fold.
export function useHintExpiry(
  { hint, visible, hide }: ReturnType<typeof useTourHint>,
  active: boolean,
) {
  useEffect(() => {
    if (!visible || !active) return;
    const id = window.setTimeout(hide, hint.stage === "next" ? 8000 : 12000);
    return () => window.clearTimeout(id);
  }, [hint, visible, active, hide]);
}
