"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Monitor,
  Package,
  Server,
  Smartphone,
} from "lucide-react";
import { trackGithubVisit } from "@/lib/analytics";
import {
  DOWNLOAD_ENTRIES,
  type DesktopOs,
  type DownloadEntry,
  type ReleaseSummary,
} from "@/lib/downloads";
import { LINUX_HOST_PATH, MOBILE_PATH, RELEASES_URL } from "@/lib/links";
import {
  detectedOs,
  isDownloadPlatform,
  usePlatform,
  type Platform,
} from "@/lib/use-platform";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import {
  clearRequestedDownloadOs,
  downloadOsAnchor,
  useRequestedDownloadOs,
} from "./download-os-hash";
import { DownloadOsTabs } from "./download-os-tabs";
import { DownloadTable } from "./download-table";
import { RecommendedDownload } from "./recommended-download";
import { SendLinkButton } from "./send-link-button";

const BUILD_COUNT = Object.keys(DOWNLOAD_ENTRIES).length;

// The server render and a Mac whose chip the browser won't name both get the
// Apple Silicon build; ARM Linux has none to recommend.
function recommendedEntry(platform: Platform): DownloadEntry | null {
  if (isDownloadPlatform(platform)) return DOWNLOAD_ENTRIES[platform];
  return platform === "linux-arm" ? null : DOWNLOAD_ENTRIES["mac-arm"];
}

export function Downloads({
  release,
  children,
}: {
  release: ReleaseSummary | null;
  children?: ReactNode;
}) {
  const platform = usePlatform();
  const isUnavailable = platform === "ipad" || platform === "unsupported";
  const requested = useRequestedDownloadOs();
  const reducedMotion = useReducedMotion();
  const [picked, setPicked] = useState<DesktopOs | null>(null);
  const [showAll, setShowAll] = useState(false);
  const tableId = useId();
  const recommended = recommendedEntry(platform);
  const expanded = showAll || requested !== null || recommended === null;
  const phoneOs = requested ?? picked ?? detectedOs(platform) ?? "macos";

  useEffect(() => {
    if (!requested) return;
    document.getElementById(downloadOsAnchor(requested))?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [requested, reducedMotion]);

  return (
    <section
      id="download"
      className="scroll-mt-20 py-20 sm:py-24 border-t border-gray-200 dark:border-gray-800 text-center"
    >
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex flex-col items-center gap-3 mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 tracking-wide uppercase">
            <Package className="w-3 h-3" />
            Latest Release
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Get lpm
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Free and open source, for macOS, Windows and Linux (x86-64).
          </p>
        </div>
        {isUnavailable ? (
          <div
            className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-gray-50 px-6 py-6 dark:border-gray-800 dark:bg-white/[0.025]"
          >
            <Monitor className="mx-auto h-8 w-8 text-gray-500 dark:text-gray-400" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Get the lpm desktop app on your computer
            </p>
            <div className="mt-3">
              <Link
                href={MOBILE_PATH}
                prefetch={false}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900 dark:text-gray-200 dark:decoration-gray-600 dark:hover:text-white"
              >
                Meanwhile — get the iPhone companion
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Open lpm.cx on your Mac or PC to choose the correct installer.
            </p>
            <div className="mt-4">
              <SendLinkButton />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {recommended ? (
              <RecommendedDownload
                entry={recommended}
                platform={platform}
                release={release}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                There&apos;s no ARM build for Linux yet. The packages below are
                for 64-bit x86 (amd64) computers.
              </p>
            )}
            {recommended && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={tableId}
                onClick={() => {
                  clearRequestedDownloadOs();
                  setShowAll(!expanded);
                }}
                className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                {expanded
                  ? "Hide the full list"
                  : `All ${BUILD_COUNT} builds with sizes and requirements`}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            )}
            <div id={tableId} hidden={!expanded} className="mt-4">
              <DownloadOsTabs
                value={phoneOs}
                onChange={(os) => {
                  clearRequestedDownloadOs();
                  setPicked(os);
                }}
              />
              <DownloadTable
                recommended={isDownloadPlatform(platform) ? platform : null}
                release={release}
                phoneOs={phoneOs}
                detected={detectedOs(platform)}
              />
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-x-6 text-sm">
          <a
            href={RELEASES_URL}
            onClick={() =>
              trackGithubVisit({
                source: "downloads-releases",
                href: RELEASES_URL,
              })
            }
            className="inline-flex min-h-11 items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            View all downloads
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </a>
          <Link
            href={LINUX_HOST_PATH}
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <Server className="w-3.5 h-3.5" aria-hidden />
            Linux server host
          </Link>
          {!isUnavailable && (
            <Link
              href={MOBILE_PATH}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" aria-hidden />
              iPhone companion
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
