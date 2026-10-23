import { InstructionsEditor } from "./InstructionsEditor";
import type { MachineScope } from "./settings/machineCommands";
import { instructionsScope, useMachineInstructions } from "./settings/useMachineInstructions";
import { DEFAULT_BRANCH_NAME_INSTRUCTIONS } from "../aiInstructions";

export function BranchNameInstructionsEditor({ machine, onBack }: { machine: MachineScope; onBack: () => void }) {
  const { load, save } = useMachineInstructions(machine.commands, "branchName", DEFAULT_BRANCH_NAME_INSTRUCTIONS);
  return (
    <InstructionsEditor
      title="Branch name instructions"
      description={`Custom instructions for AI-generated branch names. ${instructionsScope(machine.name)}`}
      placeholder={DEFAULT_BRANCH_NAME_INSTRUCTIONS}
      load={load}
      save={save}
      onBack={onBack}
    />
  );
}
