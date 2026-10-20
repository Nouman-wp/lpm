import type { NewTabPick } from "../../newTabPick";
import { LauncherModelChoices } from "./LauncherModelChoices";

// The model and level an agent's row in the + popup opens it with, unfolded
// under the row.
export function LauncherModelPicker({
  pick,
  onChange,
}: {
  pick: NewTabPick;
  onChange: (pick: NewTabPick) => void;
}) {
  return (
    <div className="mb-1.5 ml-9 mr-1.5 mt-0.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 pb-2.5 pt-2">
      <LauncherModelChoices pick={pick} onChange={onChange} />
    </div>
  );
}
