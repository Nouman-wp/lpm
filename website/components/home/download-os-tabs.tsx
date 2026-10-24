"use client";

import { DOWNLOAD_OS_ORDER, OS_NAMES, type DesktopOs } from "@/lib/downloads";
import { OsIcon } from "./os-icon";

type Props = {
  value: DesktopOs;
  onChange: (os: DesktopOs) => void;
};

// Six rows and their notes make a long column on a narrow screen, so there it
// shows one system at a time.
export function DownloadOsTabs({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Choose a system"
      className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-gray-100 p-1 sm:hidden dark:bg-white/[0.06]"
    >
      {DOWNLOAD_OS_ORDER.map((os) => {
        const active = os === value;
        return (
          <button
            key={os}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(os)}
            className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13.5px] transition-colors ${
              active
                ? "bg-white font-semibold text-gray-900 shadow-sm dark:bg-white/[0.12] dark:text-white"
                : "font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <OsIcon os={os} className="-mt-0.5 h-3.5 w-3.5" />
            {OS_NAMES[os]}
          </button>
        );
      })}
    </div>
  );
}
