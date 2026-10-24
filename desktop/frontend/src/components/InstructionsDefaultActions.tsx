import { insertDefault } from "../instructionSources";

const TEXT_BUTTON =
  "rounded px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40";

interface InstructionsDefaultActionsProps {
  content: string;
  // lpm's built-in instructions.
  defaultText: string;
  // Resetting a project's instructions clears them, so the global ones apply;
  // resetting the global ones restores the built-in text.
  resetClears?: boolean;
  onChange: (content: string) => void;
}

export function InstructionsDefaultActions({
  content,
  defaultText,
  resetClears = false,
  onChange,
}: InstructionsDefaultActionsProps) {
  const resetText = resetClears ? "" : defaultText;
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onChange(insertDefault(content, defaultText))}
        disabled={content.includes(defaultText.trim())}
        title="Add lpm's built-in instructions to edit from"
        className={TEXT_BUTTON}
      >
        Insert default
      </button>
      <button
        type="button"
        onClick={() => onChange(resetText)}
        disabled={content.trim() === resetText.trim()}
        title={
          resetClears
            ? "Clear these instructions so the global ones apply"
            : "Replace with lpm's built-in instructions"
        }
        className={TEXT_BUTTON}
      >
        Reset to default
      </button>
    </div>
  );
}
