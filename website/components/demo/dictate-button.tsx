"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { ComposerIconButton } from "./composer-icon-button";
import { FOCUS_RING, PRESS } from "./ui";

// What the demo hears when you dictate. Written the way people actually talk to
// an agent — filler and all — so the AI actions beside it have something to
// tighten up.
const TRANSCRIPT = "can you take a look at the failing test and just fix it please";
const DICTATION_MS = 2000;

/** Dictation is a toggle in the app: it records until you stop it, then adds
 *  what it heard to the field that had focus. */
export function DictateButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const timer = useRef<number | null>(null);
  // The auto-stop fires two seconds after the click, so it has to hand the
  // transcript to the handler as it is *then*: anything typed while recording is
  // part of the field the transcript appends to.
  const latest = useRef(onTranscript);
  useEffect(() => {
    latest.current = onTranscript;
  });

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const stop = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setRecording(false);
    latest.current(TRANSCRIPT);
  };

  if (!recording) {
    return (
      <ComposerIconButton
        label="Dictate"
        tooltip="Dictate"
        onClick={() => {
          setRecording(true);
          timer.current = window.setTimeout(stop, DICTATION_MS);
        }}
      >
        <Mic className="h-3.5 w-3.5" />
      </ComposerIconButton>
    );
  }

  return (
    <button
      type="button"
      aria-label="Stop dictation"
      // Don't pull focus off the field, so it still has focus when the transcript lands.
      onMouseDown={(e) => e.preventDefault()}
      onClick={stop}
      className={`flex h-7 items-center gap-1.5 rounded-lg bg-[#f87171]/15 px-2 text-[11px] font-medium text-[#f87171] ${PRESS} ${FOCUS_RING}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#f87171]" />
      Recording
    </button>
  );
}
