"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

export type Device = { id: string; name: string; paired: string };

const INITIAL_DEVICES: Device[] = [
  { id: "iphone", name: "iPhone 16 Pro", paired: "paired 3 weeks ago" },
  { id: "ipad", name: "iPad Air", paired: "paired 2 days ago" },
];

export type MobileSettingsState = {
  enabled: boolean;
  setEnabled: Dispatch<SetStateAction<boolean>>;
  tailscale: boolean;
  setTailscale: Dispatch<SetStateAction<boolean>>;
  port: number;
  setPort: Dispatch<SetStateAction<number>>;
  devices: Device[];
  setDevices: Dispatch<SetStateAction<Device[]>>;
};

// One phone setup for the whole frame, so the Mobile page and the picker's
// Phone screen never disagree about what is paired.
export function useMobileSettingsState(): MobileSettingsState {
  const [enabled, setEnabled] = useState(true);
  const [tailscale, setTailscale] = useState(true);
  const [port, setPort] = useState(8765);
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  return {
    enabled,
    setEnabled,
    tailscale,
    setTailscale,
    port,
    setPort,
    devices,
    setDevices,
  };
}
