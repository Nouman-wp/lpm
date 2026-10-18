import { useCallback, useMemo } from "react";
import { withDefault } from "../../aiInstructions";
import type { InstructionKind, MachineCommands } from "./machineCommands";

// One kind of a machine's AI instructions, loaded as `fallback` while none are
// saved so the default is there to edit.
export function useMachineInstructions(commands: MachineCommands, kind: InstructionKind, fallback: string) {
  const load = useMemo(
    () => withDefault(() => commands.readInstructions(kind), fallback),
    [commands, kind, fallback],
  );
  const save = useCallback((content: string) => commands.saveInstructions(kind, content), [commands, kind]);
  return { load, save };
}

// How far a machine's own instructions reach.
export function instructionsScope(machineName: string | null): string {
  return machineName ? `Applied to all projects on ${machineName}.` : "Applied globally to all projects.";
}
