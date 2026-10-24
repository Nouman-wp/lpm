import { useEffect, useState } from "react";
import { ReadProjectInstructions } from "../../bridge/commands";
import {
  INSTRUCTION_PARTS,
  instructionsInEffect,
  partInEffect,
  type InstructionsInEffect,
  type InstructionsTarget,
} from "../instructionSources";
import { useInstructionsDialog } from "../store/instructionsDialog";
import type { MachineCommands } from "./settings/machineCommands";

const text = (value: unknown) => (typeof value === "string" ? value : "");

// Which instructions a generation for `target` would use in this project, read
// again whenever the instructions editor closes.
export function useInstructionsInEffect(
  projectName: string,
  target: InstructionsTarget,
  machine: MachineCommands,
): InstructionsInEffect | null {
  const closedCount = useInstructionsDialog((s) => s.closedCount);
  const [inEffect, setInEffect] = useState<InstructionsInEffect | null>(null);

  useEffect(() => {
    if (!projectName) return;
    let cancelled = false;
    void Promise.all(
      INSTRUCTION_PARTS[target].map(async (part) => {
        const [own, global] = await Promise.all([
          ReadProjectInstructions(projectName, part.key).then(text, () => ""),
          machine.readInstructions(part.machineKind).then(text, () => ""),
        ]);
        return partInEffect(part, own, global);
      }),
    ).then((parts) => {
      if (!cancelled) setInEffect(instructionsInEffect(parts));
    });
    return () => {
      cancelled = true;
    };
  }, [projectName, target, machine, closedCount]);

  return inEffect;
}
