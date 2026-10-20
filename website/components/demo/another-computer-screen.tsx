"use client";

import { useState } from "react";
import { Grip, LaptopMinimal, Plus } from "lucide-react";
import { ConnectComputerPanel } from "./connect-computer-panel";
import { MobileToggle } from "./ui-kit";
import { FOCUS_RING } from "./ui";

const GROUP_HEADER =
  "mb-2 text-xs font-medium uppercase tracking-wider text-[#919191]";
const GROUP =
  "divide-y divide-[#2e2e2e] overflow-hidden rounded-xl border border-[#2e2e2e]";
const ROW = "flex items-center gap-3 px-4 py-3";
const PRIMARY_BUTTON = `shrink-0 rounded-lg bg-[#e5e5e5] px-3 py-1.5 text-xs font-medium text-[#1a1a1a] transition-opacity hover:opacity-90 disabled:opacity-60 ${FOCUS_RING}`;
const QUIET_BUTTON = `shrink-0 rounded-md px-2.5 py-1 text-xs text-[#919191] transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5] ${FOCUS_RING}`;

const PORT = 8766;
const PAIRING_CODE = "7F3A-C29E";
const PAIRING_HOST = "192.168.1.24";
const INVITE =
  "lpm-pair:eyJ2IjoyLCJoIjpbIjE5Mi4xNjguMS4yNCJdLCJwIjo4NzY2LCJjIjoiN0YzQS1DMjlFIn0";

const TAILSCALE_STEPS = [
  "Sign in to Tailscale on this Mac. It's free for personal use.",
  "On your other Macs, turn it on in Settings → Connections with the same account.",
  "Macs paired before pick up the new address the next time they connect.",
];

// The app's Settings → Connections as the picker shows it under Another
// computer: what this Mac lets in, then what it reaches out to.
export function AnotherComputerScreen() {
  const [allowed, setAllowed] = useState(false);
  const [port, setPort] = useState(PORT);
  const [pairing, setPairing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tailscaleOpen, setTailscaleOpen] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  const startPairing = () => {
    setAllowed(true);
    setPairing(true);
  };

  const copyInvite = () => {
    navigator.clipboard
      .writeText(INVITE)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };

  return (
    <div className="min-h-0 overflow-y-auto px-5 pb-5">
      <p className="mb-6 mt-2 text-[12px] leading-relaxed text-[#919191]">
        Connect this Mac to another Mac and work across both from one place.
        A connected machine&apos;s projects appear in your sidebar and open
        just like local ones.
      </p>

      <h2 className={GROUP_HEADER}>This Mac</h2>
      <div className={GROUP}>
        <div className="flex items-center gap-4 bg-[#242424] px-4 py-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors"
            style={{
              backgroundColor: allowed ? "rgba(74, 222, 128, 0.15)" : "#333333",
              color: allowed ? "#4ade80" : "#919191",
            }}
          >
            <LaptopMinimal size={20} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#e5e5e5]">
              Allow control of this Mac
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px]">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${allowed ? "bg-[#4ade80]" : "bg-[#919191]"}`}
              />
              <span className="truncate text-[#919191]">
                {allowed
                  ? `On · port ${port}`
                  : "Off — turn on to let another Mac connect"}
              </span>
            </div>
          </div>
          <MobileToggle
            checked={allowed}
            onChange={setAllowed}
            aria-label="Allow control of this Mac"
          />
        </div>

        {allowed && (
          <div className={ROW}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#e5e5e5]">Port</p>
              <p className="text-[11px] leading-relaxed text-[#919191]">
                The port other Macs connect to.
              </p>
            </div>
            <input
              type="number"
              aria-label="Port"
              autoComplete="off"
              value={port}
              min={1024}
              max={65535}
              onChange={(e) => setPort(Number(e.target.value) || 0)}
              className={`w-20 rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] px-2 py-1 text-sm tabular-nums text-[#e5e5e5] outline-none focus:border-[#22d3ee] ${FOCUS_RING}`}
            />
          </div>
        )}

        <div>
          <div className={ROW}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#333333] text-[#919191]">
              <Grip size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-[#e5e5e5]">
                Built-in Tailscale
                <span className="rounded-full bg-[#22d3ee]/[0.14] px-1.5 py-px text-[10px] font-medium text-[#22d3ee]">
                  Recommended
                </span>
              </p>
              <p className="text-[11px] leading-relaxed text-[#919191]">
                Reach your other Macs from anywhere, no Tailscale app needed
              </p>
            </div>
            {!tailscaleOpen && (
              <button
                type="button"
                onClick={() => setTailscaleOpen(true)}
                className={PRIMARY_BUTTON}
              >
                Set up
              </button>
            )}
          </div>
          {tailscaleOpen && (
            <div className="px-4 pb-3.5 pl-16">
              <ol className="space-y-1.5">
                {TAILSCALE_STEPS.map((text, i) => (
                  <li
                    key={text}
                    className="flex gap-2.5 text-[12px] leading-relaxed text-[#919191]"
                  >
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#333333] text-[10px] font-semibold tabular-nums text-[#b3b3b3]">
                      {i + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Signing in to Tailscale happens in the app"
                  className={PRIMARY_BUTTON}
                >
                  Sign in with Tailscale
                </button>
                <button
                  type="button"
                  onClick={() => setTailscaleOpen(false)}
                  className={QUIET_BUTTON}
                >
                  Not now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <h2 className={`${GROUP_HEADER} mt-8`}>Macs that can control this Mac</h2>
      <div className={GROUP}>
        {!pairing && (
          <p className="px-4 py-5 text-center text-[12px] text-[#919191]">
            No Macs paired yet. Pair one to let it open this Mac&apos;s projects.
          </p>
        )}
        {pairing ? (
          <div className="bg-[#4ade80]/[0.05] px-4 py-4">
            <p className="text-sm font-medium text-[#e5e5e5]">
              Waiting for another Mac to join
            </p>
            <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-[#919191]">
              Copy this invite and paste it on the other Mac. It works once and
              stays active until used.
            </p>
            <div className="flex items-stretch gap-2">
              <code
                title={INVITE}
                className="min-w-0 flex-1 self-center truncate rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-2 font-mono text-xs text-[#b3b3b3]"
              >
                {INVITE}
              </code>
              <button
                type="button"
                onClick={copyInvite}
                className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${FOCUS_RING} ${
                  copied
                    ? "bg-[#22d3ee]/[0.16] text-[#22d3ee]"
                    : "bg-[#22d3ee] text-white hover:opacity-90"
                }`}
              >
                {copied ? "Copied" : "Copy invite"}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[11px] text-[#919191]">
                Or enter manually:{" "}
                <span className="font-mono tracking-widest text-[#b3b3b3]">
                  {PAIRING_CODE}
                </span>{" "}
                · {PAIRING_HOST}:{port}
              </p>
              <button
                type="button"
                onClick={() => setPairing(false)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs text-[#919191] transition-colors hover:bg-[#2a2a2a] hover:text-[#f87171] ${FOCUS_RING}`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startPairing}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] text-[#919191]">
              <Plus size={14} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#e5e5e5]">Pair another Mac</p>
              <p className="text-[11px] text-[#919191]">
                Create a one-time invite to paste on the other Mac.
              </p>
            </div>
          </button>
        )}
      </div>

      <h2 className={`${GROUP_HEADER} mt-8`}>Macs you connect to</h2>
      <div className={GROUP}>
        <ConnectComputerPanel onConnect={() => setUnreachable(true)} />
      </div>
      {unreachable && (
        <p className="mt-2 px-1 text-[11px] text-[#919191]">
          This demo has no other Mac to reach. In the app, a connected
          Mac&apos;s projects join your sidebar.
        </p>
      )}
    </div>
  );
}
