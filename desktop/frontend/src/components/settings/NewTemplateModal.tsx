import { modalInputClass, modalInputDefaults } from "../../forms/styles";
import { Modal } from "../ui/Modal";

export function NewTemplateModal({
  open,
  value,
  busy,
  onChange,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  value: string;
  busy: boolean;
  onChange: (next: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = value.trim().length > 0 && !busy;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      zIndexClassName="z-[60]"
      contentClassName="w-[420px] rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-xl"
    >
      <h3 className="text-base font-semibold text-[var(--text-primary)]">New template</h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Pick a short, memorable name. You'll use it to add this template to your projects.
      </p>
      <input
        autoFocus
        {...modalInputDefaults}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="e.g. rails"
        className={`${modalInputClass} mt-4 font-mono`}
      />
      <div className="mt-3 text-[11px] text-[var(--text-muted)]">
        After saving, add this snippet to any project's config:
        <pre className="mt-1 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-[11px] text-[var(--text-primary)]">
{`extends: [${value.trim() || "your-name"}]`}
        </pre>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </div>
    </Modal>
  );
}
