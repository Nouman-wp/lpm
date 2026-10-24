import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  describeLoss,
  holdsConfig,
  lineDiffStats,
  lostActionCount,
  lostEntries,
  withKeptActions,
} from "../configReview";
import { validateYaml } from "../yamlValidation";
import { FilesDiffEditor } from "./files/FilesDiffEditor";
import { LineCounts } from "./LineCounts";

interface AIConfigReviewProps {
  current: string;
  generated: string;
  onDiscard: () => void;
  // The config to put in the editor, and whether to save it straight away.
  onApply: (yaml: string, save: boolean) => void;
}

const noop = () => {};

// What a generated config would change, before it replaces the one in the
// editor: both side by side, and a warning naming what the user wrote that the
// new one leaves out.
export function AIConfigReview({ current, generated, onDiscard, onApply }: AIConfigReviewProps) {
  const [keepActions, setKeepActions] = useState(false);
  const initialLost = useMemo(() => lostEntries(current, generated), [current, generated]);
  const canKeep = initialLost !== null && lostActionCount(initialLost) > 0;
  const result = useMemo(
    () => (keepActions && canKeep ? withKeptActions(generated, current) : generated),
    [keepActions, canKeep, generated, current],
  );
  const lost = useMemo(() => lostEntries(current, result), [current, result]);
  const stats = useMemo(() => lineDiffStats(current, result), [current, result]);
  const invalid = useMemo(() => validateYaml(result), [result]);
  const replacing = holdsConfig(current);
  const loss = lost ? describeLoss(lost) : null;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-baseline gap-3">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Review generated config</h3>
        <LineCounts added={stats.added} removed={stats.removed} className="text-xs" />
      </div>

      {replacing && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 px-3 py-2 text-[12px] leading-snug text-[var(--accent-amber-text)]">
          <AlertCircle size={15} className="mt-px shrink-0 text-[var(--accent-amber)]" />
          <span className="min-w-0 flex-1">
            {loss ? `Replaces your current config: ${loss}` : "Replaces your current config."}
          </span>
          {canKeep && (
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 font-medium">
              <input
                type="checkbox"
                checked={keepActions}
                onChange={(e) => setKeepActions(e.target.checked)}
              />
              Keep my actions too
            </label>
          )}
        </div>
      )}

      {invalid && (
        <p className="mt-3 rounded-md bg-[var(--accent-red)]/10 p-2 text-xs text-[var(--accent-red)]">
          {invalid}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
        <span>Current</span>
        <span className="pl-3">Generated</span>
      </div>
      <div className="mt-1.5 h-[min(56vh,560px)] overflow-hidden rounded-md border border-[var(--border)]">
        <FilesDiffEditor
          path="lpm.yml"
          original={current}
          value={result}
          onChange={noop}
          onSave={noop}
          readOnly
        />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={onDiscard}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          Discard
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onApply(result, false)}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Apply
          </button>
          <button
            onClick={() => onApply(result, true)}
            disabled={invalid !== null}
            title={invalid ? "Fix it in the editor with Apply first" : undefined}
            className="rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-primary)] transition-all hover:opacity-90 disabled:opacity-40"
          >
            Apply &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}
