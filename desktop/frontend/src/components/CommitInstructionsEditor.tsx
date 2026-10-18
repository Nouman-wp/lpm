import { InstructionsEditor } from "./InstructionsEditor";
import type { MachineScope } from "./settings/machineCommands";
import { instructionsScope, useMachineInstructions } from "./settings/useMachineInstructions";
import { DEFAULT_COMMIT_INSTRUCTIONS } from "../aiInstructions";

export function CommitInstructionsEditor({ machine, onBack }: { machine: MachineScope; onBack: () => void }) {
  const { load, save } = useMachineInstructions(machine.commands, "commit", DEFAULT_COMMIT_INSTRUCTIONS);
  return (
    <InstructionsEditor
      title="Commit Instructions"
      description={`Custom instructions for AI-generated commit messages. ${instructionsScope(machine.name)}`}
      placeholder={DEFAULT_COMMIT_INSTRUCTIONS}
      load={load}
      save={save}
      onBack={onBack}
    />
  );
}
