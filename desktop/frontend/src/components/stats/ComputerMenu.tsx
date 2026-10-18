import { useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";
import type { UsageMachine } from "../../types";
import { formatTokenCount } from "../../agentUsageFormat";
import { isLinuxHost } from "../../peer/platform";
import { ServerIcon } from "../icons";
import { LaptopIcon } from "../connections/LaptopIcon";
import { ContextMenuItem } from "../ui/ContextMenuItem";
import { ContextMenuSeparator } from "../ui/ContextMenuSeparator";
import { ContextMenuShell } from "../ui/ContextMenuShell";
import {
  ALL_MACHINES,
  isCounted,
  machineLabel,
  machineStatus,
  machinesNoun,
} from "./statsMachines";

interface ComputerMenuProps {
  machines: UsageMachine[];
  selected: string;
  onSelect: (id: string) => void;
}

function MachineIcon({ machine }: { machine: UsageMachine }) {
  return isLinuxHost(machine) ? <ServerIcon /> : <LaptopIcon size={14} />;
}

function Trailing({ tokens, checked }: { tokens?: number; checked: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {tokens !== undefined && <span className="tabular-nums">{formatTokenCount(tokens)}</span>}
      <span className="flex w-3.5 justify-center text-[var(--accent-blue)]">
        {checked && <Check size={13} />}
      </span>
    </span>
  );
}

/** The Stats header's pick of whose usage to show: one computer or all of them. */
export function ComputerMenu({ machines, selected, onSelect }: ComputerMenuProps) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const close = () => setAt(null);
  const pick = (id: string) => () => {
    close();
    if (id !== selected) onSelect(id);
  };

  const allLabel = `All ${machinesNoun(machines).many}`;
  const current = machines.find((m) => m.id === selected);
  const counted = machines.filter(isCounted);
  const allTokens = counted.every((m) => m.totalTokens !== undefined)
    ? counted.reduce((sum, m) => sum + (m.totalTokens ?? 0), 0)
    : undefined;

  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={at !== null}
        onMouseDown={(e) => {
          if (at) e.stopPropagation();
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { x: rect.right, y: rect.bottom + 4 });
        }}
        className="flex h-8 max-w-[220px] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] pl-2.5 pr-2 text-xs font-medium text-[var(--text-secondary)] transition-colors duration-[120ms] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
      >
        <span className="flex shrink-0 items-center">
          {current ? <MachineIcon machine={current} /> : <Layers size={14} />}
        </span>
        <span className="truncate">{current ? machineLabel(current) : allLabel}</span>
        <ChevronDown size={13} className="shrink-0 text-[var(--text-muted)]" />
      </button>
      {at && (
        <ContextMenuShell x={at.x} y={at.y} align="end" minWidth={260} onClose={close}>
          <ContextMenuItem
            icon={<Layers size={14} />}
            label={allLabel}
            description={
              counted.length === machines.length
                ? "Added together"
                : `${counted.length} of ${machines.length} added together`
            }
            trailing={<Trailing tokens={allTokens} checked={!current} />}
            onClick={pick(ALL_MACHINES)}
          />
          <ContextMenuSeparator />
          {machines.map((machine) => (
            <ContextMenuItem
              key={machine.id}
              icon={<MachineIcon machine={machine} />}
              label={machineLabel(machine)}
              description={machineStatus(machine)}
              title={machine.error}
              disabled={!machine.connected}
              trailing={
                <Trailing
                  tokens={machine.error ? undefined : machine.totalTokens}
                  checked={machine.id === selected}
                />
              }
              onClick={pick(machine.id)}
            />
          ))}
        </ContextMenuShell>
      )}
    </>
  );
}
