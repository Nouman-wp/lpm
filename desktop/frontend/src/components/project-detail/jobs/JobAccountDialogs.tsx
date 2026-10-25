import { toast } from "../../../notifications/toast";
import type { ClaudeAccount } from "../../../types";
import { ClaudeAddAccountModal } from "../../ClaudeAddAccountModal";
import { ClaudeLoginModal } from "../../ClaudeLoginModal";
import { useClaudeAccountsSource } from "../../settings/useClaudeAccountsSource";

export type JobAccountDialog = { kind: "add" } | { kind: "signIn"; account: ClaudeAccount } | null;

// Adding a Claude account and signing in to one from the automation editor,
// the way Settings does it, so the automation is never left behind.
export function JobAccountDialogs({
  dialog,
  host,
  onAdded,
  onClose,
}: {
  dialog: JobAccountDialog;
  host: string | null;
  onAdded: (account: ClaudeAccount) => void;
  onClose: () => void;
}) {
  const source = useClaudeAccountsSource(host);
  if (!source || !dialog) return null;

  if (dialog.kind === "add") {
    return (
      <ClaudeAddAccountModal
        takenNames={["Main login", ...source.accounts.map((a) => a.label)]}
        onClose={onClose}
        onAdd={async (label) => {
          try {
            onAdded(await source.add(label));
          } catch (err) {
            toast.error(`Failed to add account: ${String(err)}`);
          }
        }}
      />
    );
  }

  const { account } = dialog;
  const pooled = source.pool?.accounts.find((a) => a.id === account.id);
  return (
    <ClaudeLoginModal
      account={account}
      startLogin={source.startLogin}
      status={{
        signedIn: pooled?.signedIn ?? source.statuses[account.id]?.signedIn ?? false,
        email: pooled?.email || source.statuses[account.id]?.email || "",
        planLabel: pooled?.planLabel ?? "",
      }}
      refresh={source.refresh}
      onClose={onClose}
    />
  );
}
