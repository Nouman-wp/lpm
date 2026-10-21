"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

const MESSAGE =
  "The lpm link you sent came through cut off. Could you copy it again and send the whole thing?";

// A broken invite can only be fixed by the person who made it, so the page
// hands the guest a message to send back.
export function ResendRequest() {
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MESSAGE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const range = document.createRange();
      if (!textRef.current) return;
      range.selectNodeContents(textRef.current);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-gray-200 bg-white p-5 text-left dark:border-gray-800 dark:bg-white/[0.02]">
      <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
        Ask them to send it again
      </h2>
      <div className="mt-3 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.03]">
        <p
          ref={textRef}
          className="min-w-0 flex-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300"
        >
          {MESSAGE}
        </p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] font-medium text-gray-900 transition-colors hover:border-gray-400 dark:border-gray-700 dark:bg-transparent dark:text-gray-100 dark:hover:border-gray-500"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
        A full link is one long line that starts with{" "}
        <span className="font-mono text-[0.92em] text-gray-700 dark:text-gray-300">
          lpm.cx/join#
        </span>
        . Chat apps sometimes cut it at a line break, so ask for it on a line of
        its own.
      </p>
    </div>
  );
}
