import { PRInstructionsForm } from "./PRInstructionsForm";
import { InstructionsHeader } from "./InstructionsHeader";
import type { MachineScope } from "./settings/machineCommands";
import { instructionsScope, useMachineInstructions } from "./settings/useMachineInstructions";
import { DEFAULT_PR_TITLE_INSTRUCTIONS, DEFAULT_PR_DESCRIPTION_INSTRUCTIONS } from "../aiInstructions";

export function PRInstructionsEditor({
  machine,
  onBack,
  backTitle = "Back to Settings",
}: {
  machine: MachineScope;
  onBack: () => void;
  backTitle?: string;
}) {
  const title = useMachineInstructions(machine.commands, "prTitle", DEFAULT_PR_TITLE_INSTRUCTIONS);
  const description = useMachineInstructions(
    machine.commands,
    "prDescription",
    DEFAULT_PR_DESCRIPTION_INSTRUCTIONS,
  );
  return (
    <div className="flex flex-1 flex-col pt-6">
      <InstructionsHeader
        title="PR instructions"
        description={`Custom instructions for AI-generated pull request titles and descriptions. ${instructionsScope(machine.name)}`}
        onBack={onBack}
        backTitle={backTitle}
      />

      <PRInstructionsForm
        titleLoad={title.load}
        titleSave={title.save}
        descLoad={description.load}
        descSave={description.save}
      />
    </div>
  );
}
