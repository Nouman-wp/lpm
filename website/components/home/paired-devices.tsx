"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { AppStoreButton } from "@/components/app-store-button";
import { AppStoreScan } from "@/components/app-store-scan";
import { DevicesCapabilities } from "@/components/home/devices-capabilities";
import { ComputerPanel, ServerPanel } from "@/components/home/devices-panels";
import {
  DevicesTabs,
  tabId,
  type DeviceTab,
} from "@/components/home/devices-tabs";
import { SyncLink } from "@/components/home/paired-devices-link";
import { usePairedDevicesLoop } from "@/components/home/paired-devices-loop";
import { MacReplica } from "@/components/home/paired-devices-mac";
import { MotionToggle } from "@/components/home/paired-devices-pause";
import { PhoneReplica } from "@/components/home/paired-devices-phone";
import { DeviceStatus } from "@/components/home/paired-devices-status";
import { SectionHeader } from "@/components/section-header";
import { MOBILE_PATH } from "@/lib/links";

type Props = {
  // false on the iPhone page itself, which keeps only the mirror, drops
  // everything that would point back at that page, and tells the handoff in
  // its own words so the two pages don't share a block of copy.
  companionLink?: boolean;
  flush?: boolean;
};

const COPY = {
  home: {
    eyebrow: "Across devices",
    title: "The same terminal, on your Mac and in your pocket",
    description:
      "When Claude Code, Codex or Gemini CLI needs you, your iPhone gets a notification. Answer from the phone, then take control back at your desk — one session, running on your Mac the whole time.",
    summary:
      "An illustration of one Claude Code session on a Mac and an iPhone. The agent tightens a login rate limiter in lpm on the Mac, then stops to ask before committing, and the locked iPhone gets a notification. Opening it brings up the same terminal on the phone, which takes control, so the Mac shows “Active in iPhone” with a Take control button. From the phone you answer “yes — commit & open the PR” and the agent carries on. Then the Mac takes control back and the phone shows the terminal is active there.",
  },
  computer: {
    title: "Your other computers, in the same sidebar",
    description:
      "Pair a Mac mini or another computer running lpm, and its projects appear in your sidebar. Start Claude Code and Codex there, and they keep working when your laptop closes.",
  },
  server: {
    title: "A Linux server that keeps your agents running",
    description:
      "Type user@server and lpm sets itself up there. Services and agents keep running after your laptop closes.",
  },
  mobile: {
    eyebrow: "Desktop + iPhone",
    title: "Watch one session change hands",
    description:
      "A Claude Code turn stops for approval on the Mac, the push lands on your iPhone, and you answer there. The Mac then takes the terminal back; the session itself never leaves the Mac.",
    summary:
      "An animation of one Claude Code session handed between a Mac and an iPhone. The agent pauses before it commits, and a push reaches the locked phone. Tapping it moves the terminal to the phone, so the Mac tab reads “Active in iPhone” and offers Take control. The reply goes in from the phone, the agent keeps working, and then the Mac takes the terminal back.",
  },
};

export function PairedDevices({ companionLink = true, flush = false }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  // The iPhone page only ever shows the phone.
  const [tab, setTab] = useState<DeviceTab>("iphone");
  const onPhoneTab = tab === "iphone";
  const idBase = useId();
  const panelId = `${idBase}-panel`;
  const {
    reduced,
    visible,
    typed,
    isTyping,
    working,
    owner,
    phoneOpen,
    notified,
    tap,
  } = usePairedDevicesLoop(sectionRef, paused || !onPhoneTab);

  const status = <DeviceStatus working={working} />;
  const copy = companionLink ? COPY.home : COPY.mobile;
  const heading = onPhoneTab ? copy : COPY[tab];

  return (
    <section
      ref={sectionRef}
      data-pd-paused={paused || !onPhoneTab || undefined}
      className={`${flush ? "pb-16 sm:pb-20" : "py-16 sm:py-20"} overflow-x-clip`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          className={companionLink ? "mb-8" : "mb-12"}
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <span
                className="relative inline-flex h-1.5 w-1.5"
                aria-hidden="true"
              >
                <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {copy.eyebrow}
            </span>
          }
          title={heading.title}
          description={heading.description}
        />

        {companionLink && (
          <div className="mb-12">
            <DevicesTabs
              value={tab}
              onChange={setTab}
              idBase={idBase}
              panelId={panelId}
            />
          </div>
        )}

        <div
          id={panelId}
          role={companionLink ? "tabpanel" : undefined}
          aria-labelledby={companionLink ? tabId(idBase, tab) : undefined}
        >
          {tab === "computer" && <ComputerPanel />}
          {tab === "server" && <ServerPanel />}
          {onPhoneTab && (
            <>
              <p className="sr-only">{copy.summary}</p>

              {/* On a phone the iPhone overlaps the Mac's corner instead of
                  stacking under it, so both devices fit on one screen. */}
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="relative block h-[27.5rem] sm:flex sm:h-auto sm:flex-row sm:items-center sm:justify-center"
                >
                  <div className="pointer-events-none absolute -inset-x-8 -inset-y-10 bg-grid" />
                  <MacReplica
                    className="max-sm:w-[86%]"
                    controlled={owner === "mac"}
                    taking={tap === "mac"}
                    visible={visible}
                    status={status}
                    working={working}
                  />
                  <SyncLink animate={!reduced && !paused} />
                  <PhoneReplica
                    className="max-sm:absolute max-sm:right-0 max-sm:top-24 max-sm:origin-top-right max-sm:scale-[0.68]"
                    open={phoneOpen}
                    controlled={owner === "phone"}
                    notified={notified}
                    pressed={tap === "notification"}
                    visible={visible}
                    status={status}
                    typed={typed}
                    isTyping={isTyping}
                  />
                </div>
                {!reduced && (
                  <MotionToggle
                    paused={paused}
                    onToggle={() => setPaused((p) => !p)}
                    className="absolute bottom-0 left-0 sm:left-auto sm:right-0 sm:-bottom-14 lg:bottom-0"
                  />
                )}
              </div>

              {companionLink && (
                <>
                  <div className="mt-12 flex flex-col items-center gap-3 text-center sm:mt-14">
                    <div className="flex flex-col items-center gap-4 md:flex-row">
                      <AppStoreButton source="home-devices" />
                      <AppStoreScan />
                    </div>
                    <p className="text-pretty text-[13px] text-gray-500 dark:text-gray-400">
                      lpm link for iPhone and iPad. Scan one QR code to pair it
                      with your computer.{" "}
                      <Link
                        href={MOBILE_PATH}
                        className="font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900 hover:decoration-current dark:text-gray-300 dark:decoration-gray-600 dark:hover:text-white"
                      >
                        See the iPhone app
                      </Link>
                    </p>
                  </div>
                  <div className="mt-10 border-t border-gray-200 pt-10 sm:mt-14 sm:pt-12 dark:border-gray-800/60">
                    <DevicesCapabilities />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
