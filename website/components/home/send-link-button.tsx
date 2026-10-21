"use client";

import { useState } from "react";
import { Check, Share } from "lucide-react";
import { SITE_URL } from "@/lib/links";

const DOWNLOAD_URL = `${SITE_URL}/#download`;

// lpm installs on a computer, so a phone's useful move is getting this page
// there: the share sheet reaches AirDrop and Messages, and browsers without
// one copy the link instead.
export function SendLinkButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const send = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "lpm", url: DOWNLOAD_URL });
      } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(DOWNLOAD_URL);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={send}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 transition-colors hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:bg-transparent dark:text-gray-200 dark:hover:border-gray-500 dark:hover:text-white"
      >
        {state === "copied" ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Share className="h-4 w-4" aria-hidden />
        )}
        {state === "copied" ? "Link copied" : "Send the link to your computer"}
      </button>
      {state === "failed" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Open <span className="font-medium select-all">lpm.cx</span> on your
          computer to download.
        </p>
      )}
    </div>
  );
}
