"use client";

import type { ReactNode } from "react";
import { trackDownload } from "@/lib/analytics";
import type { DownloadEntry } from "@/lib/downloads";

export function DownloadLink({
  entry,
  className,
  children,
}: {
  entry: DownloadEntry;
  className?: string;
  children: ReactNode;
}) {
  return (
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
      className={className}
    >
      {children}
    </a>
  );
}
