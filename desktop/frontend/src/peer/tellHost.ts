import { TerminalTabOp } from "../../bridge/commands";
import { IS_MIRROR_WINDOW } from "../mirror";
import { hostFollows } from "./hostFollows";
import { isPeerName } from "./markers";

// A tab edit made here, sent on to the host that owns the tab. It comes back
// with the host's next listing, which is what this Mac then shows.
export function tellHost(
  projectName: string,
  op: "rename" | "pin" | "reorder" | "title",
  change: { id?: string; label?: string; emoji?: string; order?: string[] },
): void {
  if (IS_MIRROR_WINDOW || !isPeerName(projectName) || !hostFollows(projectName)) return;
  void TerminalTabOp(
    projectName,
    op,
    change.id ?? null,
    change.label ?? null,
    change.emoji ?? null,
    change.order ?? null,
  ).catch(() => {});
}
