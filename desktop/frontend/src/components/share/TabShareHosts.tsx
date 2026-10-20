import { ShareTabPopover } from "./ShareTabPopover";
import { ShareKnocks } from "./ShareKnocks";
import { JoinSharedTabDialog } from "./JoinSharedTabDialog";

// Tab sharing's popover, knocks and join dialog, mounted once at the app root.
export function TabShareHosts() {
  return (
    <>
      <ShareTabPopover />
      <ShareKnocks />
      <JoinSharedTabDialog />
    </>
  );
}
