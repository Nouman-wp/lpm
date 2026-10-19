import type { RefObject } from "react";
import { TerminalComposer } from "../TerminalComposer";
import { ComposerReopenBar } from "../ComposerReopenBar";
import { useComposerStore } from "../../store/composer";
import type { SharedTabTerminalHandle } from "./SharedTabTerminal";

const noop = () => {};

// The prompt box under a shared tab: the one a local agent tab has, opened and
// closed with it, sending text only. While the host keeps the tab view only it
// stays in place, inert, so the terminal above doesn't move when typing is
// switched on.
export function SharedTabComposer({
  terminalId,
  label,
  hostName,
  canType,
  fontSize,
  terminal,
}: {
  terminalId: string;
  label: string;
  hostName: string;
  canType: boolean;
  fontSize: number;
  terminal: RefObject<SharedTabTerminalHandle | null>;
}) {
  const open = useComposerStore((s) => s.open);
  if (!open) return <ComposerReopenBar targetLabel={label} fontSize={fontSize} />;
  return (
    <div className="relative">
      <div inert={!canType} className={canType ? undefined : "opacity-40"}>
        <TerminalComposer
          key={terminalId}
          terminalId={terminalId}
          historyKey={terminalId}
          projectName=""
          shown={canType}
          focused={canType}
          targetLabel={label}
          terminals={[]}
          cwd=""
          fontSize={fontSize}
          canFork={false}
          onFork={noop}
          canForkCopy={false}
          onForkCopy={noop}
          onSubmit={(input) => terminal.current?.submitInput(input) ?? false}
          onFocusTerminal={() => terminal.current?.focus()}
          onRunInDuplicates={noop}
          onOpenMemorySession={noop}
          onDetachMemory={noop}
          guest
        />
      </div>
      {!canType && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-[var(--bg-primary)]/90 px-3 py-1 text-xs text-[var(--text-secondary)] shadow">
            {hostName} hasn't let you type
          </span>
        </div>
      )}
    </div>
  );
}
