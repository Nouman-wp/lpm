import { LaptopMinimal, Wifi } from "lucide-react";
import { PairDemoMiniAgents } from "./pair-demo-mini-agents";
import {
  BORDER,
  GROUP,
  GROUP_HEADER,
  IDLE_TILE,
  LAPTOP_NAME,
  LIVE_TILE,
  MUTED,
  PRIMARY,
  SAS,
  TILE,
} from "./pair-demo-styles";
import type { PairStep } from "./use-pair-sequence";

export function PairDemoMini({ step }: { step: PairStep }) {
  if (step === "running") return <PairDemoMiniAgents />;

  const asking = step === "waiting" || step === "accept";
  const paired = step === "connected";

  return (
    <>
      <div className={GROUP}>
        <div className="flex items-center gap-3 bg-[#1f1f1f] px-3.5 py-3.5">
          <span className={`${TILE} h-10 w-10 rounded-xl`} style={LIVE_TILE}>
            <LaptopMinimal size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-semibold ${PRIMARY}`}>
              Allow control of this Mac
            </span>
            <span className="mt-0.5 flex items-baseline gap-1.5 text-[11px] leading-snug">
              <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-[#4ade80]" />
              <span className={MUTED}>On · works on this network only</span>
            </span>
          </span>
          <span
            aria-hidden
            className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-[#4ade80]"
          >
            <span className="absolute left-[19px] top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow" />
          </span>
        </div>
        <div className={`flex items-center gap-3 border-t ${BORDER} px-3.5 py-3`}>
          <span className={TILE} style={IDLE_TILE}>
            <Wifi size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-[13px] font-medium ${PRIMARY}`}>
              Same network
            </span>
            <span className={`block text-[11px] leading-snug ${MUTED}`}>
              192.168.1.24 · only while the other Mac is on this network
            </span>
          </span>
        </div>
      </div>

      <p className={`${GROUP_HEADER} mt-5`}>Your Macs</p>
      <div className={GROUP}>
        {paired ? (
          <div className="flex items-center gap-3 px-3.5 py-3">
            <span className={TILE} style={IDLE_TILE}>
              <LaptopMinimal size={16} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-medium ${PRIMARY}`}>
                {LAPTOP_NAME}
              </span>
              <span className={`block text-[11px] leading-snug ${MUTED}`}>
                Can open this Mac&rsquo;s projects from over there
              </span>
            </span>
          </div>
        ) : (
          <p className={`px-3.5 py-4 text-center text-[11px] ${MUTED}`}>
            Nothing connected yet.
          </p>
        )}
      </div>

      {asking && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-3">
          <div
            className={`w-full max-w-[19rem] rounded-2xl border ${BORDER} bg-[#1c1c1c] p-4 shadow-2xl`}
          >
            <p className={`text-sm font-semibold ${PRIMARY}`}>
              Let {LAPTOP_NAME} control this Mac?
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#b3b3b3]">
              It could open every project and run commands here. Make sure this
              code matches the one on{" "}
              <span className={`font-medium ${PRIMARY}`}>{LAPTOP_NAME}</span>.
            </p>
            <div
              className={`mt-3 rounded-xl border ${BORDER} bg-[#161616] py-2.5 text-center font-mono text-2xl font-semibold tracking-[0.2em] tabular-nums ${PRIMARY}`}
            >
              {SAS}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <span
                className={`rounded-lg border ${BORDER} px-3 py-1.5 text-[12px] font-medium text-[#b3b3b3]`}
              >
                Deny
              </span>
              <span
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#1a1a1a] transition-all duration-200 ${
                  step === "accept" ? "scale-95 bg-[#bdbdbd]" : "bg-[#ededed]"
                }`}
              >
                Accept
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
