"use client";

import { Smartphone } from "lucide-react";
import { MobileSettings } from "./mobile-settings";
import type { MobileSettingsState } from "./mobile-settings-state";

export function MobileView({ settings }: { settings: MobileSettingsState }) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1a1a]">
      <div className="flex h-12 shrink-0 items-center gap-2.5 px-3 sm:px-4">
        <span className="text-[#919191]">
          <Smartphone className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight text-[#e5e5e5]">Mobile app</div>
          <div className="text-[11px] text-[#919191]">
            Answer your agents from your phone — every command still runs on this Mac
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#2e2e2e] px-3 py-3 sm:px-4">
        <div className="mx-auto w-full max-w-[560px]">
          <MobileSettings state={settings} />
        </div>
      </div>
    </div>
  );
}
