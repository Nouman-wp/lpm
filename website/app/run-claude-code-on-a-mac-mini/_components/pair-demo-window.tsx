import type { ReactNode } from "react";
import { BORDER, MUTED, PRIMARY } from "./pair-demo-styles";

export function PairDemoWindow({
  name,
  role,
  children,
}: {
  name: string;
  role: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border ${BORDER} bg-[#1a1a1a]`}
    >
      <div className={`flex items-center gap-2 border-b ${BORDER} px-3 py-2`}>
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3a]" />
        </span>
        <span className={`ml-1 truncate text-[12px] font-medium ${PRIMARY}`}>
          {name}
        </span>
        <span
          className={`ml-auto shrink-0 text-[10px] uppercase tracking-[0.15em] ${MUTED}`}
        >
          {role}
        </span>
      </div>
      <div className="relative min-h-[21.75rem] flex-1 p-3.5 sm:p-4">
        {children}
      </div>
    </div>
  );
}
