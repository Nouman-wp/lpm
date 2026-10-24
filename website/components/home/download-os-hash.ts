import { useSyncExternalStore } from "react";
import { DOWNLOAD_OS_ORDER, type DesktopOs } from "@/lib/downloads";

const PREFIX = "download-";

export const downloadOsAnchor = (os: DesktopOs) => `${PREFIX}${os}`;

// Absolute, so a link from any page lands on the home page's table.
export const downloadOsHref = (os: DesktopOs) => `/#${downloadOsAnchor(os)}`;

// replaceState fires no event, so clearing the request tells subscribers itself.
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("hashchange", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("hashchange", notify);
  };
}

function requestedOs(): DesktopOs | null {
  const hash = window.location.hash.slice(1);
  return DOWNLOAD_OS_ORDER.find((os) => hash === downloadOsAnchor(os)) ?? null;
}

// A "/#download-windows" link asks the download section to open its full
// table on that system. The request lives in the URL until the visitor makes
// a choice of their own, which clears it.
export function useRequestedDownloadOs(): DesktopOs | null {
  return useSyncExternalStore(subscribe, requestedOs, () => null);
}

export function clearRequestedDownloadOs() {
  if (!requestedOs()) return;
  window.history.replaceState(null, "", "#download");
  listeners.forEach((notify) => notify());
}
