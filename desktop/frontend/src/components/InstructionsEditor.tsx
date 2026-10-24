import { useYamlEditor } from "../hooks/useYamlEditor";
import { primaryHint } from "../shortcutHints";
import { InstructionsDefaultActions } from "./InstructionsDefaultActions";
import { InstructionsHeader } from "./InstructionsHeader";

interface InstructionsEditorProps {
  title: string;
  description: string;
  defaultText: string;
  resetClears?: boolean;
  load: () => Promise<string>;
  save: (content: string) => Promise<void>;
  onBack: () => void;
  backTitle?: string;
}

export function InstructionsEditor({
  title,
  description,
  defaultText,
  resetClears,
  load,
  save,
  onBack,
  backTitle = "Back to Settings",
}: InstructionsEditorProps) {
  const { content, setContent, dirty, saving, error, handleSave, handleSaveKey } =
    useYamlEditor(load, save);

  return (
    <div className="flex flex-1 flex-col pt-6">
      <InstructionsHeader title={title} description={description} onBack={onBack} backTitle={backTitle} />

      <div className="mt-3 flex justify-end">
        <InstructionsDefaultActions
          content={content}
          defaultText={defaultText}
          resetClears={resetClears}
          onChange={setContent}
        />
      </div>
      <div className="mt-1 flex min-h-0 flex-1 flex-col relative rounded-lg border border-[var(--border)] overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleSaveKey}
          spellCheck={false}
          className="min-h-0 flex-1 w-full resize-none bg-[var(--bg-primary)] px-4 py-3 text-xs leading-relaxed text-[var(--text-primary)] outline-none"
          placeholder={defaultText}
        />
        {(dirty || error) && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2">
            {error && (
              <span className="flex-1 text-xs text-[var(--accent-red)]">{error}</span>
            )}
            <span className="text-[10px] text-[var(--text-muted)]">{primaryHint("s")}</span>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-md bg-[var(--text-primary)] px-3 py-1 text-xs font-medium text-[var(--bg-primary)] transition-all hover:opacity-85 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
