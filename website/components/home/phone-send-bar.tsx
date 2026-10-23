"use client";

import { useEffect, useState } from "react";
import { Check, Share } from "lucide-react";
import { isMobilePlatform, usePlatform } from "@/lib/use-platform";
import { SendLinkFailed, useSendLink } from "./send-link-button";

// A phone can't install lpm, and the page is long, so once the hero's own
// button scrolls away this bar keeps the one useful step in reach. It goes
// for good at Get lpm, which has the same button, so it never sits over the
// footer.
export function PhoneSendBar() {
  const platform = usePlatform();
  const onPhone = isMobilePlatform(platform);
  const [show, setShow] = useState(false);
  const { state, send } = useSendLink();

  useEffect(() => {
    if (!onPhone) return;
    const hero = document.getElementById("hero");
    const download = document.getElementById("download");
    if (!hero || !download) return;
    let heroInView = true;
    let downloadAhead = true;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) heroInView = entry.isIntersecting;
        else
          downloadAhead =
            !entry.isIntersecting && entry.boundingClientRect.top > 0;
      }
      setShow(!heroInView && downloadAhead);
    });
    observer.observe(hero);
    observer.observe(download);
    return () => observer.disconnect();
  }, [onPhone]);

  if (!onPhone) return null;

  return (
    <div
      inert={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-300 ease-out motion-reduce:transition-none dark:border-gray-800 dark:bg-[#0b0b0c]/95 ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            lpm runs on your Mac or PC
          </p>
          {state === "failed" ? (
            <SendLinkFailed />
          ) : (
            <p className="text-[12.5px] text-gray-500 dark:text-gray-400">
              Send yourself the link for later.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={send}
          className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-gray-900 px-4 text-[15px] font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          {state === "copied" ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Share className="h-4 w-4" aria-hidden="true" />
          )}
          {state === "copied" ? "Copied" : "Send link"}
        </button>
      </div>
    </div>
  );
}
