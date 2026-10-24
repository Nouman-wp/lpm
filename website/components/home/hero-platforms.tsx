import Link from "next/link";
import type { DownloadEntry } from "@/lib/downloads";
import { MOBILE_PATH } from "@/lib/links";
import { DotRow } from "./dot-row";
import { downloadOsHref } from "./download-os-hash";

const ITEM =
  "text-gray-600 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900 hover:decoration-current dark:text-gray-300 dark:decoration-gray-600 dark:hover:text-white";

type Item = { label: string; href: string };

function itemsFor(primary: DownloadEntry): Item[] {
  const mac: Item =
    primary.platform === "mac-arm"
      ? { label: "Intel Macs", href: downloadOsHref("macos") }
      : primary.platform === "mac-intel"
        ? { label: "Apple Silicon Macs", href: downloadOsHref("macos") }
        : { label: "macOS", href: downloadOsHref("macos") };
  return [
    mac,
    primary.os !== "windows" && {
      label: "Windows 11",
      href: downloadOsHref("windows"),
    },
    primary.os !== "linux" && {
      label: "Linux x86-64",
      href: downloadOsHref("linux"),
    },
    { label: "iPhone", href: MOBILE_PATH },
  ].filter((item): item is Item => Boolean(item));
}

// The split button's chevron is the only other hint that lpm isn't Mac-only,
// so the other systems get one quiet line of their own under it.
export function HeroPlatforms({ primary }: { primary: DownloadEntry }) {
  return (
    <p className="hidden items-center justify-center gap-x-2 text-[13px] text-gray-500 sm:flex dark:text-gray-400">
      <span>Also for</span>
      <DotRow
        items={itemsFor(primary).map(({ label, href }) =>
          href.startsWith("/#") ? (
            <a key={label} href={href} className={ITEM}>
              {label}
            </a>
          ) : (
            <Link key={label} href={href} prefetch={false} className={ITEM}>
              {label}
            </Link>
          ),
        )}
      />
    </p>
  );
}
