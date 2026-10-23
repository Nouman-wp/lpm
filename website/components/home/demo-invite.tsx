"use client";

import { useEffect, useState, type RefObject } from "react";
import { MousePointer2 } from "lucide-react";
import type { TourInvite } from "./tour";

type Box = { top: number; left: number; width: number; height: number };

const RETRY_MS = 200;
const RETRIES = 15;

// The invited control's box. The app in the iframe is served from this
// origin, so its document is readable here, and the iframe fills the frame, so
// its coordinates are the frame's. The control is found the way the tour's own
// steps find it: by its label on screen.
function locate(iframe: HTMLIFrameElement, label: string): Box | null {
  const doc = iframe.contentDocument;
  if (!doc) return null;
  for (const el of doc.querySelectorAll("button")) {
    const name = (el.getAttribute("aria-label") || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    if (name !== label) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

// A ring on the control the visitor should click first, with the line asking
// for it hung underneath, until the visitor clicks.
export function DemoInvite({
  iframeRef,
  invite,
  hidden,
}: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  invite: TourInvite;
  hidden: boolean;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (hidden || !iframe) return;
    let tries = 0;
    let timer = 0;
    // The app may still be laying out its header when it reports ready.
    const measure = () => {
      window.clearTimeout(timer);
      const next = locate(iframe, invite.button);
      setBox(next);
      setFrameWidth(iframe.clientWidth);
      if (!next && tries++ < RETRIES) {
        timer = window.setTimeout(measure, RETRY_MS);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(iframe);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [iframeRef, invite.button, hidden]);

  if (!box) return null;
  const fade = hidden ? "opacity-0" : "opacity-100";

  return (
    <>
      <span
        aria-hidden="true"
        className={`demo-invite-ring pointer-events-none absolute z-30 rounded-lg border-2 border-[#60a5fa] transition-opacity duration-500 ${fade}`}
        style={{
          top: box.top - 4,
          left: box.left - 4,
          width: box.width + 8,
          height: box.height + 8,
        }}
      />
      <div
        role="status"
        aria-live="polite"
        aria-hidden={hidden}
        className={`pointer-events-none absolute z-30 w-max max-w-[230px] transition-all duration-500 ${
          hidden ? "translate-y-1" : "translate-y-0"
        } ${fade}`}
        style={{
          top: box.top + box.height + 12,
          right: frameWidth - (box.left + box.width),
        }}
      >
        <span
          aria-hidden="true"
          className="absolute -top-1 h-2.5 w-2.5 rotate-45 bg-[#e5e5e5]"
          style={{ right: box.width / 2 - 5 }}
        />
        <p className="relative flex items-start gap-2 rounded-lg bg-[#e5e5e5] px-3 py-2 text-[12px] font-medium leading-snug text-[#1a1a1a] shadow-2xl">
          <MousePointer2
            aria-hidden="true"
            className="mt-px h-3.5 w-3.5 shrink-0 text-[#2563eb]"
            strokeWidth={2.25}
          />
          {invite.hint}
        </p>
      </div>
    </>
  );
}
