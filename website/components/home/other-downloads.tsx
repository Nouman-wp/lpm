"use client";

import {
  DOWNLOAD_OS_ORDER,
  DOWNLOADS_BY_OS,
  isBetaOs,
  OS_NAMES,
  shortChoiceLabel,
  type DownloadPlatform,
} from "@/lib/downloads";
import { BetaTag } from "./beta-tag";
import { DownloadLink } from "./download-link";
import { OsIcon } from "./os-icon";

const CHIP =
  "inline-flex min-h-8 items-center rounded-full border border-gray-200 px-2.5 text-[12.5px] font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white";

// Every other build, one click each, grouped by system so nobody has to open
// the full table to find theirs.
export function OtherDownloads({ except }: { except: DownloadPlatform }) {
  const groups = DOWNLOAD_OS_ORDER.map((os) => ({
    os,
    entries: DOWNLOADS_BY_OS[os].filter((e) => e.platform !== except),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-5 sm:px-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-gray-500 sm:pt-2 dark:text-gray-400">
        Other systems
      </p>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        {groups.map(({ os, entries }) => (
          <li key={os} className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
              <OsIcon os={os} className="-mt-0.5 h-3.5 w-3.5" />
              {OS_NAMES[os]}
              {isBetaOs(os) && (
                <BetaTag className="border-gray-300 text-gray-500 dark:border-gray-700 dark:text-gray-400" />
              )}
            </span>
            {entries.map((entry) => (
              <DownloadLink key={entry.platform} entry={entry} className={CHIP}>
                {shortChoiceLabel(entry)}
              </DownloadLink>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
