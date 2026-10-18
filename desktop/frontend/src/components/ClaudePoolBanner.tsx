import { openClaudeAccountSettings } from "../store/claudeAccountPin";
import { useClaudePoolStore } from "../store/claudePool";
import { useMachineClaudeStore } from "../store/machineClaude";
import { ClaudePoolNotes } from "./ClaudePoolNotes";

const NOTHING_DISMISSED: Record<string, string> = {};

/** Sidebar notes from account switching, on this Mac and on each connected
 *  machine. */
export function ClaudePoolBanner() {
  const pool = useClaudePoolStore((s) => s.pool);
  const dismissed = useClaudePoolStore((s) => s.dismissed);
  const accept = useClaudePoolStore((s) => s.accept);
  const dismiss = useClaudePoolStore((s) => s.dismiss);
  const machines = useMachineClaudeStore((s) => s.machines);
  const aliases = useMachineClaudeStore((s) => s.aliases);
  const dismissedOn = useMachineClaudeStore((s) => s.dismissed);
  const acceptOn = useMachineClaudeStore((s) => s.accept);
  const dismissOn = useMachineClaudeStore((s) => s.dismiss);

  return (
    <>
      {pool && (
        <ClaudePoolNotes
          pool={pool}
          dismissed={dismissed}
          onAccept={(key) => void accept(key)}
          onDismiss={dismiss}
          onOpenSettings={() => openClaudeAccountSettings()}
        />
      )}
      {Object.entries(aliases).map(([slug, alias]) => {
        const machine = machines[slug];
        if (!machine?.pool) return null;
        return (
          <ClaudePoolNotes
            key={slug}
            pool={machine.pool}
            dismissed={dismissedOn[slug] ?? NOTHING_DISMISSED}
            machine={alias}
            accounts={machine.accounts}
            onAccept={(key) => void acceptOn(slug, key)}
            onDismiss={(key) => dismissOn(slug, key)}
            onOpenSettings={() => openClaudeAccountSettings(slug)}
          />
        );
      })}
    </>
  );
}
