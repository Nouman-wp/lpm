import { useEffect, useState } from "react";
import { modalInputClass } from "../../forms/styles";
import { Modal } from "../ui/Modal";

export function PassphraseModal({
  open,
  title,
  body,
  submitLabel,
  confirm = false,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  body: string;
  submitLabel: string;
  // When true, require a matching confirm input. Used for export flows where
  // a typo locks the user out of their own backup.
  confirm?: boolean;
  onCancel: () => void;
  onSubmit: (passphrase: string) => void;
}) {
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPass("");
      setConfirmPass("");
      setError(null);
    }
  }, [open]);

  const submit = () => {
    if (pass.length < 8) {
      setError("Passphrase must be at least 8 characters.");
      return;
    }
    if (confirm && pass !== confirmPass) {
      setError("Passphrases don't match.");
      return;
    }
    onSubmit(pass);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      zIndexClassName="z-[60]"
      contentClassName="w-[420px] rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-xl"
    >
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{body}</p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--text-secondary)]">Passphrase</span>
          <input
            type="password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              setError(null);
            }}
            autoFocus
            className={modalInputClass}
            placeholder="At least 8 characters"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !confirm) submit();
            }}
          />
        </label>
        {confirm && (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[var(--text-secondary)]">Confirm passphrase</span>
            <input
              type="password"
              value={confirmPass}
              onChange={(e) => {
                setConfirmPass(e.target.value);
                setError(null);
              }}
              className={modalInputClass}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </label>
        )}
        {error && (
          <p className="rounded-md bg-[var(--accent-red)]/10 px-2 py-1 text-xs text-[var(--accent-red-text)]">{error}</p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          className="rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs text-[var(--bg-primary)]"
        >
          {submitLabel}
        </button>
      </div>
    </Modal>
  );
}
