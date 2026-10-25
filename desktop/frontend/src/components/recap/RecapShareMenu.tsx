import { Download, Share } from "lucide-react";
import { RevealInFinder } from "../../../bridge/commands";
import { revealLabel } from "../../machineWords";
import { toast } from "../../notifications/toast";
import { isMac } from "../../platform";
import { ContextMenuItem } from "../ui/ContextMenuItem";
import { ContextMenuSeparator } from "../ui/ContextMenuSeparator";
import { ContextMenuShell } from "../ui/ContextMenuShell";
import type { RecapTheme } from "./recapCardTheme";
import { NetworkLogo } from "./NetworkLogo";
import { copyRecapImage, openRecapPost, saveRecapImage, shareRecapImage } from "./recapShare";
import type { RecapView } from "./weeklyRecapModel";

const PASTE = isMac ? "⌘V" : "Ctrl+V";

const failed = (what: string) => (error: unknown) =>
  toast.error(`Couldn't ${what}: ${String(error)}`);

interface RecapShareMenuProps {
  anchor: HTMLElement;
  view: RecapView;
  theme: RecapTheme;
  onClose: () => void;
  run: (work: () => Promise<unknown>) => void;
}

/** Everywhere the card goes besides the clipboard, under the Share button. */
export function RecapShareMenu({ anchor, view, theme, onClose, run }: RecapShareMenuProps) {
  const pick = (work: () => Promise<unknown>) => () => {
    onClose();
    run(work);
  };

  return (
    <ContextMenuShell anchor={anchor} minWidth={240} onClose={onClose}>
      <ContextMenuItem
        icon={<NetworkLogo network="x" size={12} />}
        label="Copy and post on X"
        description={`Opens X; paste the card with ${PASTE}`}
        onClick={pick(() =>
          copyRecapImage(view, theme)
            .then(() => {
              openRecapPost(view, "x");
              toast.success("Card copied", { description: `Paste it into the post with ${PASTE}` });
            })
            .catch(failed("make the post")),
        )}
      />
      <ContextMenuItem
        icon={<NetworkLogo network="linkedin" size={12} />}
        label="Save and post on LinkedIn"
        description="Opens LinkedIn; add the card with its photo button"
        onClick={pick(() =>
          saveRecapImage(view, theme)
            .then((path) => {
              openRecapPost(view, "linkedin");
              toast.success("Card saved to Downloads", {
                description: "In the post, add it with the photo button, or drag it in",
                action: { label: revealLabel(), onClick: () => void RevealInFinder(path) },
              });
            })
            .catch(failed("make the post")),
        )}
      />
      {isMac && (
        <ContextMenuItem
          icon={<Share size={12} />}
          label="Share with friends…"
          description="Messages, Mail, AirDrop"
          onClick={pick(() => shareRecapImage(view, theme, anchor.getBoundingClientRect()).catch(failed("open sharing")))}
        />
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<Download size={12} />}
        label="Save to Downloads"
        onClick={pick(() =>
          saveRecapImage(view, theme)
            .then((path) =>
              toast.success("Saved the card to Downloads", {
                action: { label: revealLabel(), onClick: () => void RevealInFinder(path) },
              }),
            )
            .catch(failed("save the image")),
        )}
      />
    </ContextMenuShell>
  );
}
