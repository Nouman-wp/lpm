import { ChevronDown, LaptopMinimal } from "lucide-react";
import {
  AGENTS,
  GROUP,
  GROUP_HEADER,
  HOST_NAME,
  LIVE_TILE,
  MUTED,
  PRIMARY,
  PROJECT,
  TILE,
} from "./pair-demo-styles";

const OTHER_PROJECTS = [
  { name: "shop-web", detail: "Running", live: true },
  { name: "notes", detail: "Stopped", live: false },
];

export function PairDemoSidebar({ running }: { running: boolean }) {
  return (
    <>
      <p className={GROUP_HEADER}>Your Macs</p>
      <div className={GROUP}>
        <div className="flex items-center gap-3 px-3.5 py-3">
          <span className={TILE} style={LIVE_TILE}>
            <LaptopMinimal size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm font-medium ${PRIMARY}`}>
              {HOST_NAME}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4ade80]" />
              <span className={`truncate ${MUTED}`}>Connected</span>
            </span>
          </span>
          <ChevronDown size={14} className={MUTED} aria-hidden />
        </div>
      </div>

      <p className={`${GROUP_HEADER} mt-5`}>{HOST_NAME} · in your sidebar</p>
      <ul className={`${GROUP} divide-y divide-[#2e2e2e]`}>
        <li className="px-3.5 py-2.5">
          <span className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4ade80]" />
            <span className={`min-w-0 flex-1 truncate text-[13px] ${PRIMARY}`}>
              {PROJECT}
            </span>
            <span className={`shrink-0 text-[11px] ${MUTED}`}>Running</span>
          </span>
          {running &&
            AGENTS.map(({ glyph, color, name, elapsed }) => (
              <span
                key={name}
                title={`Working — ${name} in ${PROJECT}`}
                className="mt-1.5 flex items-center gap-2 pl-4 text-[12px]"
              >
                <span style={{ color }} aria-hidden>
                  {glyph}
                </span>
                <span className="sidebar-shimmer min-w-0 flex-1 truncate">
                  {name}
                </span>
                <span className={`w-7 shrink-0 text-right text-[11px] tabular-nums ${MUTED}`}>
                  {elapsed}
                </span>
              </span>
            ))}
        </li>
        {OTHER_PROJECTS.map(({ name, detail, live }) => (
          <li key={name} className="flex items-center gap-2.5 px-3.5 py-2.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? "bg-[#4ade80]" : "bg-[#3a3a3a]"}`}
            />
            <span className={`min-w-0 flex-1 truncate text-[13px] ${PRIMARY}`}>
              {name}
            </span>
            <span className={`shrink-0 text-[11px] ${MUTED}`}>{detail}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
