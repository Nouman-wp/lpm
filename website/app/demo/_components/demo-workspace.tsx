"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HOME_TOUR,
  type TourHandle,
  type TourState,
} from "@/components/home/tour";
import { DownloadLink } from "@/components/download-link";
import { DemoFrame } from "@/components/home/demo-frame";
import { DemoSteps } from "@/components/home/demo-steps";
import { WINDOW_FRAME } from "@/components/home/demo-window";
import { StartChooser, type DemoStart } from "./start-chooser";

const DEMO_HEIGHT = "min(720px, calc(100vh - 230px))";

const SWITCH =
  "cursor-pointer underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900 hover:decoration-current dark:decoration-gray-600 dark:hover:text-white";

function FramePlaceholder() {
  return (
    <div
      aria-hidden="true"
      className={`flex h-[var(--demo-h)] items-center justify-center ${WINDOW_FRAME}`}
      style={{ "--demo-h": DEMO_HEIGHT } as React.CSSProperties}
    >
      <span className="text-[13px] text-[#5c5c5c]">Loading demo…</span>
    </div>
  );
}

function DesktopOnlyPrompt() {
  return (
    <div
      data-on-dark
      className={`flex flex-col items-center gap-3 px-5 py-10 text-center ${WINDOW_FRAME}`}
    >
      <p className="max-w-xs text-[13px] leading-relaxed text-[#919191]">
        lpm is a desktop app with a multi-pane terminal workspace. Open this page
        on your computer to try the interactive demo.
      </p>
      <DownloadLink className="inline-flex min-h-11 items-center rounded-lg bg-[#e5e5e5] px-4 py-2 text-[13px] font-medium text-[#1a1a1a] transition-all duration-100 hover:opacity-85 active:scale-[0.97]">
        Get lpm
      </DownloadLink>
    </div>
  );
}

// The window opens on a choice: the sample projects with their tour, or an
// empty workspace like a fresh install where whatever ends up in it, the
// visitor put there.
export function DemoWorkspace() {
  // null until the media query is read on the client, so the first paint
  // matches the server HTML at every width.
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [start, setStart] = useState<DemoStart | null>(null);
  const [tour, setTour] = useState<TourState>({ stage: 0, playing: false });
  const tourRef = useRef<TourHandle>(null);
  const runStep = useCallback(
    (index: number) => tourRef.current?.run(index),
    [],
  );
  // A fresh key remounts the sample at its first frame, tour and all.
  const [sampleRun, setSampleRun] = useState(0);
  const pick = useCallback((next: DemoStart) => {
    setTour({ stage: 0, playing: false });
    setSampleRun((n) => n + 1);
    setStart(next);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div data-nosnippet className="mx-auto w-full max-w-[1040px]">
      {isDesktop !== true && (
        <div className={isDesktop === null ? "md:hidden" : undefined}>
          <DesktopOnlyPrompt />
        </div>
      )}
      {isDesktop !== false && (
        <div className={isDesktop === null ? "hidden md:block" : undefined}>
          {start === "sample" && (
            <DemoSteps
              steps={HOME_TOUR.steps}
              tour={tour}
              done={HOME_TOUR.done}
              onRun={runStep}
              onRestart={() => pick("sample")}
            />
          )}
          <div className="relative">
            {!isDesktop ? (
              <FramePlaceholder />
            ) : start === "sample" ? (
              <DemoFrame
                key={`sample-${sampleRun}`}
                height={DEMO_HEIGHT}
                tour={HOME_TOUR}
                tourRef={tourRef}
                onTour={setTour}
              />
            ) : (
              <DemoFrame key="empty" height={DEMO_HEIGHT} />
            )}
            {start === null && <StartChooser onPick={pick} />}
          </div>
          {start !== null && (
            <p className="mt-4 text-center text-[13px] text-gray-500 dark:text-gray-400">
              {start === "sample" ? (
                <>
                  Showing the sample projects.{" "}
                  <button
                    type="button"
                    onClick={() => pick("empty")}
                    className={SWITCH}
                  >
                    Start empty instead
                  </button>
                </>
              ) : (
                <>
                  Showing an empty workspace.{" "}
                  <button
                    type="button"
                    onClick={() => pick("sample")}
                    className={SWITCH}
                  >
                    Load the sample projects
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
