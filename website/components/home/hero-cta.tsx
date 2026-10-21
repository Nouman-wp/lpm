"use client";

import type { ReactNode } from "react";
import { Play } from "lucide-react";
import { AppStoreButton } from "@/components/app-store-button";
import type { AppStoreSource, DownloadSource } from "@/lib/analytics";
import type { ReleaseSummary } from "@/lib/downloads";
import { DEMO_ANCHOR } from "@/lib/links";
import {
  isDownloadPlatform,
  primaryDownload,
  usePlatform,
} from "@/lib/use-platform";
import { DownloadDetails } from "./download-details";
import { DownloadSplitButton } from "./download-split-button";
import { HeroTrustLine } from "./hero-trust-line";
import { NoDownloadCard } from "./no-download-card";
import { PrimaryDownload } from "./primary-download";

// The homepage keeps the demo frame in the first viewport, so this row reserves
// its height: platform detection only runs after hydration and must not shove
// the frame down mid-load.
const SHELL =
  "flex w-full flex-col items-center gap-3 min-h-[164px] sm:min-h-[101px]";
const SPLIT_SHELL =
  "flex w-full flex-col items-center gap-4 min-h-[208px] sm:min-h-[99px]";

function DemoLink() {
  return (
    <a
      href={DEMO_ANCHOR}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 px-6 py-[13px] text-[15px] font-medium text-gray-700 transition-colors duration-200 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
    >
      <Play className="h-3.5 w-3.5" aria-hidden />
      <span className="md:hidden">Watch the demo</span>
      <span className="hidden md:inline">Try the interactive demo</span>
    </a>
  );
}

// The homepage passes the latest release, which turns the button into a split
// button listing every build and folds the fine print into one trust line.
type Menu = {
  release: ReleaseSummary | null;
  downloads: string | null;
};

// Pages that pass an App Store source turn the phone and tablet branch into
// the iPhone companion's install button instead of a no-download dead end.
export function HeroCta({
  source = "hero",
  secondary,
  appStoreSource,
  menu,
}: {
  source?: DownloadSource;
  secondary?: ReactNode;
  appStoreSource?: AppStoreSource;
  menu?: Menu;
}) {
  const platform = usePlatform();
  const onMobile = platform === "ipad" || platform === "unsupported";
  const shell = menu ? SPLIT_SHELL : SHELL;
  const trust = menu && <HeroTrustLine os={null} downloads={menu.downloads} />;

  if (onMobile && appStoreSource) {
    return (
      <div className={shell}>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-5">
          <AppStoreButton source={appStoreSource} />
          <p className="max-w-sm text-pretty text-center text-[13px] leading-relaxed text-gray-500 sm:max-w-xs sm:text-left dark:text-gray-400">
            <span className="font-medium text-gray-800 dark:text-gray-200">
              lpm link
            </span>{" "}
            follows your computer&apos;s terminals and agents from iPhone or
            iPad. Get the desktop app by opening lpm.cx on your Mac or PC.
          </p>
        </div>
        {trust}
      </div>
    );
  }

  if (onMobile || platform === "linux-arm") {
    return (
      <div className={shell}>
        <NoDownloadCard linuxArm={platform === "linux-arm"} />
        {trust}
      </div>
    );
  }

  const primary = primaryDownload(platform);
  const buttonClass = "px-6 py-3.5 text-[15px] sm:px-7 sm:text-[16px]";

  if (menu) {
    return (
      <div className={shell}>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <DownloadSplitButton
            primary={primary}
            detected={isDownloadPlatform(platform) ? platform : null}
            release={menu.release}
            source={source}
            className={buttonClass}
          />
          {secondary ?? <DemoLink />}
        </div>
        <HeroTrustLine os={primary.os} downloads={menu.downloads} />
      </div>
    );
  }

  return (
    <div className={SHELL}>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <PrimaryDownload
          entry={primary}
          source={source}
          className={buttonClass}
        />
        {secondary ?? <DemoLink />}
      </div>
      <DownloadDetails
        primary={primary}
        source={source}
        linkClassName="text-[11px] font-medium"
        rowGap="gap-1"
      />
    </div>
  );
}
