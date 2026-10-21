"use client";

import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import {
  DOWNLOADS_BY_OS,
  GIT_FOR_WINDOWS_URL,
  isBetaOs,
  OS_NAMES,
  type DesktopOs,
  type DownloadPlatform,
  type ReleaseSummary,
} from "@/lib/downloads";
import { BetaTag } from "./beta-tag";
import { DownloadRow } from "./download-row";
import { OsIcon } from "./os-icon";

export const DOWNLOAD_OS_ORDER: DesktopOs[] = ["macos", "windows", "linux"];

const REQUIREMENT: Record<DesktopOs, string> = {
  macos: "12 or later",
  windows: "11, x64",
  linux: "x86-64, Ubuntu 22.04 or newer",
};

const NOTE_LINK =
  "font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900 dark:text-gray-300 dark:decoration-gray-600 dark:hover:text-white";

const HEADER_NOTE: Record<DesktopOs, ReactNode> = {
  macos: (
    <span className="inline-flex items-center gap-1.5">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      Signed and notarized by Apple
    </span>
  ),
  windows: (
    <a
      href={GIT_FOR_WINDOWS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={NOTE_LINK}
    >
      Needs Git for Windows
    </a>
  ),
  linux: "No ARM build",
};

const FOOTNOTE: Partial<Record<DesktopOs, string>> = {
  windows:
    "Not code-signed yet: if SmartScreen warns, choose More info, then Run anyway.",
  linux:
    "Not code-signed yet. Other distributions need glibc 2.35 or newer. The .deb and .rpm bring Git, SSH and a clipboard tool along; for the AppImage, install them first.",
};

type Props = {
  recommended: DownloadPlatform | null;
  release: ReleaseSummary | null;
  // Below sm only this system is shown; the tabs above the table pick it.
  phoneOs: DesktopOs;
};

export function DownloadTable({ recommended, release, phoneOs }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-left dark:border-gray-800 dark:bg-[#111]">
      {DOWNLOAD_OS_ORDER.map((os) => (
        <section
          key={os}
          aria-label={OS_NAMES[os]}
          className={`[&:not(:first-child)]:border-t [&:not(:first-child)]:border-gray-200 dark:[&:not(:first-child)]:border-gray-800 ${
            os === phoneOs ? "" : "hidden sm:block"
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-gray-50 px-4 py-2.5 text-[13px] sm:px-5 dark:bg-white/[0.03]">
            <OsIcon
              os={os}
              className="-mt-0.5 h-4 w-4 text-gray-800 dark:text-gray-200"
            />
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {OS_NAMES[os]}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {REQUIREMENT[os]}
            </span>
            {isBetaOs(os) && (
              <BetaTag className="border-gray-300 text-gray-500 dark:border-gray-700 dark:text-gray-400" />
            )}
            <span className="text-[12px] text-gray-500 sm:ml-auto dark:text-gray-400">
              {HEADER_NOTE[os]}
            </span>
          </div>
          {DOWNLOADS_BY_OS[os].map((entry) => (
            <DownloadRow
              key={entry.platform}
              entry={entry}
              size={release?.sizes[entry.platform]}
              recommended={recommended === entry.platform}
            />
          ))}
          {FOOTNOTE[os] && (
            <p className="border-t border-gray-100 px-4 py-2.5 text-[12px] leading-relaxed text-gray-500 sm:px-5 dark:border-white/[0.05] dark:text-gray-400">
              {FOOTNOTE[os]}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
