import { ShareTabDialog } from "./ShareTabDialog";
import { ShareJoinRequestDialog } from "./ShareJoinRequestDialog";
import { JoinSharedTabDialog } from "./JoinSharedTabDialog";

// Tab sharing's dialogs, mounted once at the app root.
export function TabShareHosts() {
  return (
    <>
      <ShareTabDialog />
      <ShareJoinRequestDialog />
      <JoinSharedTabDialog />
    </>
  );
}
