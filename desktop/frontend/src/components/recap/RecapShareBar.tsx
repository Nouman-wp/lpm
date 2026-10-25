import { useState } from "react";
import { Download, LoaderCircle, Share } from "lucide-react";
import { RevealInFinder } from "../../../bridge/commands";
import { revealLabel } from "../../machineWords";
import { toast } from "../../notifications/toast";
import { isMac } from "../../platform";
import { BTN_SECONDARY } from "../ui/buttons";
import { Tooltip } from "../ui/Tooltip";
import { NetworkLogo } from "./NetworkLogo";
import { RecapCopyButton } from "./RecapCopyButton";
import { postRecap, saveRecapImage, shareRecapImage, type RecapNetwork } from "./recapShare";
import type { RecapView } from "./weeklyRecapModel";

const NETWORKS: { id: RecapNetwork; label: string }[] = [
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
];

const BUTTON = `${BTN_SECONDARY} inline-flex items-center gap-1.5`;
const NETWORK_BUTTON =
  "grid h-[30px] w-[30px] place-items-center rounded-md border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-active)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] disabled:opacity-50";

const failed = (what: string) => (error: unknown) =>
  toast.error(`Couldn't ${what}: ${String(error)}`);

/** Every way the card leaves the app, in one row under it. */
export function RecapShareBar({ view }: { view: RecapView }) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = (id: string, work: () => Promise<unknown>) => {
    setBusy(id);
    void work().finally(() => setBusy(null));
  };

  const save = () =>
    run("save", () =>
      saveRecapImage(view)
        .then((path) =>
          toast.success("Saved the card to Downloads", {
            action: { label: revealLabel(), onClick: () => void RevealInFinder(path) },
          }),
        )
        .catch(failed("save the image")),
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RecapCopyButton view={view} />
      {isMac && (
        <button
          type="button"
          disabled={busy !== null}
          className={BUTTON}
          onClick={(e) => {
            const from = e.currentTarget.getBoundingClientRect();
            run("share", () => shareRecapImage(view, from).catch(failed("open sharing")));
          }}
        >
          <Share size={13} />
          Share…
        </button>
      )}
      <button type="button" disabled={busy !== null} onClick={save} className={BUTTON}>
        <Download size={13} />
        Save
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="mr-1 text-xs text-[var(--text-muted)]">Post on</span>
        {NETWORKS.map((network) => (
          <Tooltip key={network.id} content={`Post on ${network.label}`} delay={300}>
            <button
              type="button"
              aria-label={`Post on ${network.label}`}
              disabled={busy !== null}
              className={NETWORK_BUTTON}
              onClick={() =>
                run(network.id, () => postRecap(view, network.id).catch(failed("make the post")))
              }
            >
              {busy === network.id ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <NetworkLogo network={network.id} />
              )}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
