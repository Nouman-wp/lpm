import { SOURCE_LABEL, type InstructionsInEffect } from "../instructionSources";
import type { InstructionsScope } from "../store/instructionsDialog";
import { BTN_SECONDARY } from "./ui/buttons";

interface InstructionsInEffectPanelProps {
  projectLabel: string;
  inEffect: InstructionsInEffect;
  onEdit: (scope: InstructionsScope) => void;
}

export function InstructionsInEffectPanel({ projectLabel, inEffect, onEdit }: InstructionsInEffectPanelProps) {
  const labelled = inEffect.parts.length > 1;
  return (
    <div
      role="dialog"
      aria-label="AI instructions in effect"
      className="absolute bottom-full left-0 z-20 mb-1.5 w-[340px] rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 shadow-lg"
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        In effect for {projectLabel}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {inEffect.parts.map((part) => (
          <div key={part.label}>
            {labelled && (
              <p className="mb-1 text-[10px] font-medium text-[var(--text-muted)]">
                {part.label} · {SOURCE_LABEL[part.source]}
              </p>
            )}
            <pre
              title={part.text}
              className="line-clamp-5 whitespace-pre-wrap break-words rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-[var(--text-secondary)]"
            >
              {part.text}
            </pre>
          </div>
        ))}
      </div>
      {inEffect.source === "project" && (
        <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
          This project overrides the global instructions.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => onEdit("project")} className={BTN_SECONDARY}>
          Edit for this project
        </button>
        <button type="button" onClick={() => onEdit("global")} className={BTN_SECONDARY}>
          Edit global
        </button>
      </div>
    </div>
  );
}
