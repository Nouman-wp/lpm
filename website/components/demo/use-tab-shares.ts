"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ShareVia = "browser" | "lpm";

export type ShareGuest = {
  id: string;
  name: string;
  via: ShareVia;
  canType: boolean;
};

export type ShareWaiting = {
  id: string;
  name: string;
  via: ShareVia;
  // The emoji both sides see, so the host knows who they're letting in.
  code: string;
};

export type TabShare = {
  ready: boolean;
  // What people let in from now on may do.
  canType: boolean;
  payload: string;
  waiting: ShareWaiting[];
  guests: ShareGuest[];
};

// Where the popover opened from, in the project view's own coordinates. A
// zero-width anchor is a point, the way a context menu opens it.
export type ShareAnchor = { left: number; top: number; right: number; bottom: number };

export type ShareTarget = {
  key: string;
  label: string;
  anchor: ShareAnchor;
  // The project view's size, which the popover stays inside.
  bounds: { width: number; height: number };
};

// How long the link takes to make, and when someone opens it.
const LINK_MS = 600;
const KNOCK_MS = 4500;
const KNOCKER = { name: "Maya", via: "browser", code: "🦊 🌵 🎈" } as const;

function newPayload(): string {
  return Math.random().toString(36).slice(2, 12);
}

// The demo's tab shares: one per tab, made when its popover first opens, with
// one person asking to join a few seconds later.
export function useTabShares() {
  const [shares, setShares] = useState<Record<string, TabShare>>({});
  const [target, setTarget] = useState<ShareTarget | null>(null);
  const timers = useRef(new Map<string, number[]>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const ids of pending.values()) ids.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const update = (key: string, fn: (share: TabShare) => TabShare) =>
    setShares((prev) => (prev[key] ? { ...prev, [key]: fn(prev[key]) } : prev));

  const later = (key: string, ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.set(key, [...(timers.current.get(key) ?? []), id]);
  };

  const start = (key: string) => {
    setShares((prev) => ({
      ...prev,
      [key]: { ready: false, canType: false, payload: newPayload(), waiting: [], guests: [] },
    }));
    later(key, LINK_MS, () => update(key, (s) => ({ ...s, ready: true })));
    later(key, KNOCK_MS, () =>
      update(key, (s) => ({ ...s, waiting: [...s.waiting, { id: `${key}-knock`, ...KNOCKER }] })),
    );
  };

  const open = (next: ShareTarget) => {
    setTarget(next);
    if (!shares[next.key]) start(next.key);
  };

  const toggle = (next: ShareTarget) => (target?.key === next.key ? setTarget(null) : open(next));

  const close = useCallback(() => setTarget(null), []);

  const stop = (key: string) => {
    timers.current.get(key)?.forEach((id) => window.clearTimeout(id));
    timers.current.delete(key);
    setShares((prev) => {
      if (!prev[key]) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
    setTarget((t) => (t?.key === key ? null : t));
  };

  const setCanType = (key: string, canType: boolean) => update(key, (s) => ({ ...s, canType }));

  const respond = (key: string, id: string, allow: boolean) =>
    update(key, (s) => {
      const asked = s.waiting.find((w) => w.id === id);
      const waiting = s.waiting.filter((w) => w.id !== id);
      if (!asked || !allow) return { ...s, waiting };
      const guest: ShareGuest = { id, name: asked.name, via: asked.via, canType: s.canType };
      return { ...s, waiting, guests: [...s.guests, guest] };
    });

  const setGuestCanType = (key: string, id: string, canType: boolean) =>
    update(key, (s) => ({
      ...s,
      guests: s.guests.map((g) => (g.id === id ? { ...g, canType } : g)),
    }));

  const takeKeyboards = (key: string) =>
    update(key, (s) => ({ ...s, guests: s.guests.map((g) => ({ ...g, canType: false })) }));

  const removeGuest = (key: string, id: string) =>
    update(key, (s) => ({ ...s, guests: s.guests.filter((g) => g.id !== id) }));

  return {
    shares,
    target,
    open,
    toggle,
    close,
    stop,
    setCanType,
    respond,
    setGuestCanType,
    takeKeyboards,
    removeGuest,
  };
}

export type TabShares = ReturnType<typeof useTabShares>;

export function anyoneTypes(share: TabShare): boolean {
  return share.guests.some((g) => g.canType);
}

// A shared tab's marks are amber while anyone may type, cyan while all watch.
export function shareTint(share: TabShare): string {
  return anyoneTypes(share) ? "text-[#fbbf24]" : "text-[#22d3ee]";
}

export function shareLink(payload: string): string {
  return `https://lpm.cx/join#${payload}`;
}

export function shortShareLink(payload: string): string {
  return `lpm.cx/join#…${payload.slice(-4)}`;
}
