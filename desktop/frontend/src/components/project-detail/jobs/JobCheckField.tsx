import { useState } from "react";
import { Plus } from "lucide-react";
import { AIButton } from "../../ui/AIButton";
import { CheckCommandInput } from "./CheckCommandInput";

// The check that gates a run. It stays a link under the run box until it is
// added or the job already has one.
export function JobCheckField({
  value,
  project,
  onChange,
  onGenerate,
}: {
  value: string;
  project: string | undefined;
  onChange: (value: string) => void;
  onGenerate?: () => void;
}) {
  const [added, setAdded] = useState(false);

  if (!added && !value.trim()) {
    return (
      <button
        type="button"
        onClick={() => setAdded(true)}
        className="flex w-fit items-center gap-1.5 px-1 py-0.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        <Plus size={12} />
        Only run when there's work
      </button>
    );
  }

  return (
    <div className="field-reveal space-y-1.5 pt-1">
      <div className="flex items-center gap-3 px-1 text-[12px] leading-snug text-[var(--text-muted)]">
        <span className="min-w-0 flex-1">
          Runs first — the job starts only if it succeeds.
        </span>
        {onGenerate && (
          <AIButton onClick={onGenerate} title="Describe the check and let AI write it">
            Generate with AI
          </AIButton>
        )}
        <button
          type="button"
          onClick={() => {
            setAdded(false);
            onChange("");
          }}
          className="shrink-0 transition-colors hover:text-[var(--text-primary)]"
        >
          Remove
        </button>
      </div>
      <CheckCommandInput
        value={value}
        project={project}
        autoFocus={added}
        onChange={onChange}
      />
    </div>
  );
}
