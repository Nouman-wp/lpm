"use client";

import { ArrowDown } from "lucide-react";
import { trackDownload } from "@/lib/analytics";
import { formatSize, type DownloadEntry } from "@/lib/downloads";

type RowProps = {
  entry: DownloadEntry;
  size: number | undefined;
  recommended: boolean;
};

export function DownloadRow({ entry, size, recommended }: RowProps) {
  const sizeLabel = size === undefined ? null : formatSize(size);
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-t border-gray-100 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_5rem_auto] sm:px-5 dark:border-white/[0.05] ${
        recommended ? "bg-emerald-50/70 dark:bg-emerald-400/[0.05]" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {entry.choiceLabel}
          {recommended && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              />
              Recommended
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">
          {entry.choiceDescription}
          {sizeLabel && <span className="sm:hidden"> · {sizeLabel}</span>}
        </p>
      </div>
      <span className="hidden text-right font-mono text-[12px] tabular-nums text-gray-500 sm:block dark:text-gray-400">
        {sizeLabel}
      </span>
      <a
        href={entry.href}
        aria-label={entry.ariaLabel}
        onClick={() =>
          trackDownload({
            source: "downloads",
            platform: entry.platform,
            href: entry.href,
          })
        }
        className={`inline-flex items-center gap-1.5 justify-self-end whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
          recommended
            ? "bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            : "border border-gray-200 text-gray-800 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:text-white"
        }`}
      >
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        Download
      </a>
    </div>
  );
}
