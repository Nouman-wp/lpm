"use client";

import { useEffect, useSyncExternalStore } from "react";
import { HeroDownload } from "@/components/home/hero-download";
import { usePlatform } from "@/lib/use-platform";

// A link from lpm's Share tab dialog: lpm.cx/join#<invite>. The invite stays in
// the fragment, which the browser never sends to this site, and goes on to the
// lpm app as lpm://join?i=<invite>; the app asks before it joins, and the host
// lets each person in.
const PAYLOAD = /^[A-Za-z0-9_-]+$/;

function decodable(payload: string): boolean {
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return json?.v === 1 && Array.isArray(json.h) && json.h.length > 0 && !!json.p && !!json.s && !!json.f;
  } catch {
    return false;
  }
}

function readInvite(): string {
  const payload = window.location.hash.slice(1);
  return PAYLOAD.test(payload) && decodable(payload) ? payload : "";
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

// Chromium hands an unknown scheme to the OS quietly; Safari shows an error
// alert and Firefox an error page when lpm isn't installed, so there it waits
// for the button.
const opensQuietly = () => /Chrome\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);

const HEADING =
  "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 bg-clip-text text-4xl font-extrabold leading-[1.1] tracking-tight text-transparent sm:text-5xl dark:from-white dark:via-gray-100 dark:to-gray-400";
const LEAD = "mx-auto mt-5 max-w-lg text-base leading-relaxed text-gray-600 dark:text-gray-400";
const BUTTON =
  "inline-flex items-center justify-center rounded-full bg-gray-900 px-7 py-3.5 text-[17px] font-medium tracking-tight text-white shadow-sm transition-[background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-[1px] hover:bg-gray-800 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0 active:shadow-sm dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 dark:focus-visible:ring-white dark:focus-visible:ring-offset-gray-950";

export function JoinSharedTab() {
  // null until the fragment has been read in the browser.
  const invite = useSyncExternalStore(subscribe, readInvite, () => null);
  const platform = usePlatform();
  const onPhone = platform === "ipad" || platform === "unsupported";
  const appLink = invite ? `lpm://join?i=${invite}` : "";

  useEffect(() => {
    if (appLink && !onPhone && platform !== null && opensQuietly()) window.location.href = appLink;
  }, [appLink, onPhone, platform]);

  return (
    <section className="pt-[clamp(6rem,14vh,9rem)] pb-20 text-center sm:pb-24">
      <div className="mx-auto max-w-2xl px-6">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
          Shared tab
        </p>
        {invite === "" ? (
          <>
            <h1 className={HEADING}>This link isn&apos;t complete.</h1>
            <p className={LEAD}>
              Part of it is missing. Ask the person sharing the tab to send the
              link again, and copy all of it.
            </p>
          </>
        ) : (
          <>
            <h1 className={HEADING}>Join a shared tab</h1>
            <p className={LEAD}>
              Someone shared a terminal tab with you in lpm. It opens in the lpm
              app on your computer, and they let you in from theirs.
            </p>
            {onPhone ? (
              <p className="mx-auto mt-8 max-w-md rounded-xl border border-gray-200 px-5 py-4 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                Open this link on the computer where you use lpm.
              </p>
            ) : (
              <div className="mt-8 flex justify-center">
                <a href={appLink || undefined} aria-disabled={!appLink} className={BUTTON}>
                  Open lpm
                </a>
              </div>
            )}
          </>
        )}
        {!onPhone && (
          <div className="mt-16 border-t border-gray-200 pt-10 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don&apos;t have lpm yet? Install it, then open the link again.
            </p>
            <div className="mt-6 flex justify-center">
              <HeroDownload source="join" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
