import { useEffect, useRef, useState } from "react";
import { Hand, Lock } from "lucide-react";
import { PeerShareAskType } from "../../../bridge/commands";

// After "not now" the host ignores asking for 20 s (tabshare/people.rs).
const NOT_NOW_MS = 20_000;

// Over a shared tab's locked prompt box: what the host lets this machine do,
// and a way to ask for the keyboard where the host takes asking.
export function AskToType({
  slug,
  hostName,
  asked,
  askable,
}: {
  slug: string;
  hostName: string;
  asked: boolean;
  askable: boolean;
}) {
  const [notNow, setNotNow] = useState(false);
  const [error, setError] = useState("");
  const wasAsked = useRef(asked);

  useEffect(() => {
    if (wasAsked.current && !asked) {
      setNotNow(true);
      const t = window.setTimeout(() => setNotNow(false), NOT_NOW_MS);
      wasAsked.current = asked;
      return () => window.clearTimeout(t);
    }
    wasAsked.current = asked;
  }, [asked]);

  const ask = () => {
    setError("");
    void PeerShareAskType(slug).catch((err) => setError(String(err)));
  };

  const text = error || (notNow ? `Not now, ${hostName} said.` : `${hostName} lets you watch this tab.`);
  return (
    <span className="flex max-w-full items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-primary)]/95 py-1 pl-3 pr-1 text-xs text-[var(--text-secondary)] shadow">
      <Lock size={12} className="shrink-0" />
      <span className="truncate">{text}</span>
      {askable ? (
        <button
          type="button"
          onClick={ask}
          disabled={asked || notNow}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-cyan)] px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:bg-[var(--bg-active)] disabled:text-[var(--text-muted)]"
        >
          <Hand size={12} />
          {asked ? "Asked…" : "Ask to type"}
        </button>
      ) : (
        <span className="pr-2" />
      )}
    </span>
  );
}
