"use client";

import { useRef, type KeyboardEvent } from "react";
import { Laptop, Server, Smartphone, type LucideIcon } from "lucide-react";

export type DeviceTab = "iphone" | "computer" | "server";

const TABS: {
  id: DeviceTab;
  label: string;
  short: string;
  icon: LucideIcon;
}[] = [
  { id: "iphone", label: "iPhone", short: "iPhone", icon: Smartphone },
  {
    id: "computer",
    label: "Another computer",
    short: "Computer",
    icon: Laptop,
  },
  { id: "server", label: "Linux server", short: "Linux server", icon: Server },
];

export const tabId = (base: string, tab: DeviceTab) => `${base}-tab-${tab}`;

export function DevicesTabs({
  value,
  onChange,
  idBase,
  panelId,
}: {
  value: DeviceTab;
  onChange: (tab: DeviceTab) => void;
  idBase: string;
  panelId: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const at = TABS.findIndex((t) => t.id === value);
    const next = TABS[(at + step + TABS.length) % TABS.length].id;
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Where your projects run"
      onKeyDown={onKeyDown}
      className="mx-auto flex w-fit gap-1 rounded-full bg-gray-100 p-1 ring-1 ring-inset ring-gray-200 dark:bg-gray-800/60 dark:ring-white/10"
    >
      {TABS.map(({ id, label, short, icon: Icon }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(idBase, id)}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] transition-colors sm:px-4 sm:text-sm ${
              selected
                ? "bg-white font-semibold text-gray-900 shadow-[0_0_0_1px_rgba(229,231,235,1),0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#2e2e2e] dark:text-white dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
                : "font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            <Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
