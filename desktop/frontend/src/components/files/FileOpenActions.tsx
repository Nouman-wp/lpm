import { revealLabel } from "../../machineWords";
import { OpenFileWithDropdown } from "../OpenFileWithDropdown";
import { copyAbsolutePath, revealInFinder } from "./fileActions";

const BUTTON =
  "rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]";

// The ways on from a file this pane can't show: another app, its folder, its path.
export function FileOpenActions({ absPath }: { absPath: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
      <OpenFileWithDropdown absPath={absPath} line={0} col={0} />
      <button type="button" className={BUTTON} onClick={() => void revealInFinder(absPath)}>
        {revealLabel()}
      </button>
      <button type="button" className={BUTTON} onClick={() => void copyAbsolutePath(absPath)}>
        Copy path
      </button>
    </div>
  );
}
