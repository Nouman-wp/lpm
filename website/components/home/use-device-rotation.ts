"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEVICE_TABS, type DeviceTab } from "./devices-tabs";

// From md up the scenes share one reserved height, so moving on never shifts
// the page; phones and reduced motion keep the scene the visitor picks.
const QUERY = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

// How much of the stage has to be on screen for a scene to count as watched.
const SHOWN_RATIO = 0.35;

function subscribe(notify: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
}

const allowedNow = () => window.matchMedia(QUERY).matches;

// Plays the device scenes in turn until the visitor picks a tab or pauses.
// `run` changes whenever the current scene should start over: on every tab
// change, and when the stage scrolls away mid-scene, so coming back replays it
// from the start in step with its progress bar.
export function useDeviceRotation(enabled: boolean) {
  const stageRef = useRef<HTMLDivElement>(null);
  const allowed = useSyncExternalStore(subscribe, allowedNow, () => false);
  const [tab, setTab] = useState<DeviceTab>("iphone");
  const [stopped, setStopped] = useState(false);
  const [shown, setShown] = useState(false);
  const [run, setRun] = useState(0);
  const rotating = enabled && allowed && !stopped;

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !rotating) return;
    let ratio = 0;
    let was = false;
    const update = () => {
      const now = ratio >= SHOWN_RATIO && !document.hidden;
      if (now === was) return;
      was = now;
      setShown(now);
      if (!now) setRun((r) => r + 1);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        ratio = entry.intersectionRatio;
        update();
      },
      { threshold: [0, SHOWN_RATIO] },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [rotating]);

  const show = (next: DeviceTab) => {
    setTab(next);
    setRun((r) => r + 1);
  };

  return {
    stageRef,
    tab,
    run,
    rotating,
    playing: !rotating || shown,
    select: (next: DeviceTab) => {
      setStopped(true);
      if (next !== tab) show(next);
    },
    advance: () =>
      show(DEVICE_TABS[(DEVICE_TABS.indexOf(tab) + 1) % DEVICE_TABS.length]),
    stop: () => setStopped(true),
  };
}
