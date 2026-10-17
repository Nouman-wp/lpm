import { modalErrorBannerClass } from "../../forms/styles";
import { BTN_SECONDARY } from "../ui/buttons";
import type { PeerSettingsState } from "./usePeerSettings";

const TEXT = "mt-6 text-[12px] leading-relaxed text-[var(--text-secondary)]";

// What shows in place of a connected machine's settings until they can.
export function PeerSettingsNotice({
  name,
  connected,
  supported,
  state,
}: {
  name: string;
  connected: boolean;
  supported: boolean;
  state: PeerSettingsState;
}) {
  if (!connected)
    return (
      <p className={TEXT}>
        {name} isn&rsquo;t connected right now. Its settings show here once it&rsquo;s back.
      </p>
    );
  if (!supported)
    return (
      <p className={TEXT}>
        {name} runs an older lpm that can&rsquo;t share its settings. Update it, then open this
        again.
      </p>
    );
  if (state.status === "failed")
    return (
      <div className="mt-6 space-y-3">
        <p className={modalErrorBannerClass}>Couldn&rsquo;t read its settings — {state.error}</p>
        <button type="button" onClick={state.retry} className={BTN_SECONDARY}>
          Try Again
        </button>
      </div>
    );
  return <p className="mt-6 text-[12px] text-[var(--text-muted)]">Loading…</p>;
}
