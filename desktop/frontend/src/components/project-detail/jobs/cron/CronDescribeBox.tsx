import { useEffect, useState } from "react";
import { SparkleIcon } from "../../../icons";
import { AIPickerButton } from "../../../ui/AIPickerButton";
import { TransformText } from "../../../../../bridge/commands";
import { useAIPicker } from "../../../../hooks/useAIPicker";
import { isCanceledError, useAIGeneration } from "../../../../hooks/useAIGeneration";
import { CRON_INSTRUCTION, readCronReply } from "../../../../cronAI";
import { normalizeCron } from "../../../../cronExpr";
import { aiEffectiveFast } from "../../../../types";
import { enterHint } from "../../../../shortcutHints";

export interface CronAIContext {
  project?: string;
  // Empty runs the agent wherever the app runs; a line of cron needs no project.
  cwd: string;
}

// The schedule said in words, written into the cron line by the picked agent
// and model, with the line it replaced kept for an undo.
export function CronDescribeBox({
  value,
  onChange,
  ai,
}: {
  value: string;
  onChange: (cron: string) => void;
  ai: CronAIContext;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ cron: string; prev: string } | null>(null);
  const gen = useAIGeneration(ai.project ?? ai.cwd);
  const picker = useAIPicker(true, ai.project ?? ai.cwd);
  const checked = Object.keys(picker.aiCLIs).length > 0;
  const { cancel } = gen;

  useEffect(() => cancel, [cancel]);

  const canConvert = !!text.trim() && !gen.generating && picker.anyAvailable;

  const convert = async () => {
    if (!canConvert) return;
    setError("");
    setDone(null);
    const prev = value;
    try {
      const out = await gen.run((genId) =>
        TransformText(
          ai.project ?? null,
          ai.cwd,
          picker.selectedCLI,
          picker.selectedModel,
          picker.selectedEffort,
          aiEffectiveFast(picker.selectedCLI, picker.selectedModel, picker.selectedFast),
          CRON_INSTRUCTION,
          text.trim(),
          genId,
        ),
      );
      const reply = readCronReply(typeof out === "string" ? out : "");
      if ("error" in reply) {
        setError(reply.error);
        return;
      }
      setDone({ cron: reply.cron, prev });
      onChange(reply.cron);
    } catch (err) {
      if (!isCanceledError(err)) setError(`Couldn't convert it: ${String(err)}`);
    }
  };

  const hint = gen.generating
    ? `Asking ${picker.cliLabel}…`
    : checked && !picker.anyAvailable
      ? "No AI CLI found to convert with"
      : `${picker.cliLabel} turns this into a cron line · ${enterHint({ meta: true })}`;
  const applied = done && normalizeCron(value) === done.cron ? done : null;

  return (
    <div>
      <div className="mb-2 mt-6 flex items-center gap-3 px-1">
        <label
          htmlFor="cron-describe"
          className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"
        >
          Or describe it
        </label>
        <span className="h-px flex-1 bg-[var(--border)]/70" />
      </div>
      <div
        className={`rounded-xl border px-3.5 pb-2.5 pt-3 transition-colors ${
          gen.generating
            ? "border-[var(--accent-cyan)]/60"
            : "border-[var(--border)] focus-within:border-[var(--text-muted)]"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 text-[var(--accent-cyan-text)]">
            <SparkleIcon />
          </span>
          <textarea
            id="cron-describe"
            rows={2}
            value={text}
            disabled={gen.generating}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void convert();
              }
            }}
            placeholder="every weekday at 9:30 and again at 5:30pm"
            className="min-w-0 flex-1 resize-none border-none bg-transparent text-[13.5px] leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:opacity-60"
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="text-[12px] text-[var(--text-muted)]">{hint}</span>
          {picker.anyAvailable && (
            <AIPickerButton
              onGenerate={() => void convert()}
              onCancel={gen.cancel}
              generating={gen.generating}
              disabled={!canConvert}
              title={`Convert with ${picker.cliLabel}`}
              label="Convert to cron"
              generatingLabel="Converting…"
              aiCLIs={picker.aiCLIs}
              selectedCLI={picker.selectedCLI}
              selectedModel={picker.selectedModel}
              selectedEffort={picker.selectedEffort}
              selectedFast={picker.selectedFast}
              onSelect={picker.selectAI}
              onSelectEffort={picker.selectEffort}
              onSelectFast={picker.selectFast}
              menuPlacement="up"
            />
          )}
        </div>
      </div>
      {(applied || error) && (
        <p className="mt-2 px-1 text-[12px] leading-snug text-[var(--text-secondary)]">
          {applied ? (
            <>
              Set the cron line to{" "}
              <code className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-[var(--text-primary)]">
                {applied.cron}
              </code>
              . Check the sentence above.{" "}
              <button
                type="button"
                onClick={() => {
                  onChange(applied.prev);
                  setDone(null);
                }}
                className="font-medium text-[var(--accent-cyan-text)] hover:underline"
              >
                Undo
              </button>
            </>
          ) : (
            <span className="text-[var(--accent-red-text)]">{error}</span>
          )}
        </p>
      )}
    </div>
  );
}
