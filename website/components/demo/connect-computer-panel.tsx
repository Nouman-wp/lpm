"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { NO_AUTOFILL } from "./no-autofill";
import { FOCUS_RING } from "./ui";

const FIELD_CLASS =
  "rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-1.5 text-[13px] text-[#e5e5e5] outline-none transition-colors placeholder:text-[#7e7e7e] focus:border-[#22d3ee]";

function connectClass(enabled: boolean): string {
  return `shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${FOCUS_RING} ${
    enabled
      ? "bg-[#22d3ee] text-white hover:opacity-90"
      : "bg-[#333333] text-[#919191]"
  }`;
}

// The app's AddMacPanel: paste the invite the other computer made, or type
// what it contained. There is no other computer behind the demo, so a
// connect attempt says so instead.
export function ConnectComputerPanel({
  onConnect,
}: {
  onConnect: () => void;
}) {
  const [invite, setInvite] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [port, setPort] = useState("8766");
  const [code, setCode] = useState("");

  const canPaste = invite.trim().length > 0;
  const canManual = address.trim().length > 0 && code.trim().length > 0;

  return (
    <>
      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (canPaste) onConnect();
        }}
        className="flex items-center gap-2 px-4 py-3"
      >
        <input
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
          placeholder="Paste invite from the other Mac"
          aria-label="Invite"
          {...NO_AUTOFILL}
          className={`${FIELD_CLASS} min-w-0 flex-1`}
        />
        <button type="submit" disabled={!canPaste} className={connectClass(canPaste)}>
          Connect
        </button>
      </form>

      <button
        type="button"
        onClick={() => setManualOpen((v) => !v)}
        aria-expanded={manualOpen}
        className={`flex w-full items-center px-4 py-3 text-left text-[13px] text-[#b3b3b3] transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
      >
        <span className="flex-1">Enter details manually</span>
        <ChevronRight
          size={14}
          className={`text-[#919191] transition-transform ${manualOpen ? "rotate-90" : ""}`}
        />
      </button>

      {manualOpen && (
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            if (canManual) onConnect();
          }}
          className="divide-y divide-[#2e2e2e]"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address"
              aria-label="Address"
              {...NO_AUTOFILL}
              className={`${FIELD_CLASS} min-w-0 flex-1`}
            />
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="Port"
              aria-label="Port"
              inputMode="numeric"
              {...NO_AUTOFILL}
              className={`${FIELD_CLASS} w-20 shrink-0 tabular-nums`}
            />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Pairing code"
              aria-label="Pairing code"
              {...NO_AUTOFILL}
              className={`${FIELD_CLASS} min-w-0 flex-1 font-mono tracking-widest`}
            />
            <button type="submit" disabled={!canManual} className={connectClass(canManual)}>
              Connect
            </button>
          </div>
        </form>
      )}
    </>
  );
}
