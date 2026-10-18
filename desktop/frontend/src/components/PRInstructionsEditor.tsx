import { PRInstructionsForm } from "./PRInstructionsForm";
import { ChevronLeftIcon } from "./icons";
import type { MachineScope } from "./settings/machineCommands";
import { instructionsScope, useMachineInstructions } from "./settings/useMachineInstructions";
import { DEFAULT_PR_TITLE_INSTRUCTIONS, DEFAULT_PR_DESCRIPTION_INSTRUCTIONS } from "../aiInstructions";

export function PRInstructionsEditor({ machine, onBack }: { machine: MachineScope; onBack: () => void }) {
  const title = useMachineInstructions(machine.commands, "prTitle", DEFAULT_PR_TITLE_INSTRUCTIONS);
  const description = useMachineInstructions(
    machine.commands,
    "prDescription",
    DEFAULT_PR_DESCRIPTION_INSTRUCTIONS,
  );
  return (
    <div className="flex flex-1 flex-col pt-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="Back to Settings"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="text-lg font-semibold tracking-tight">PR Instructions</h1>
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
        Custom instructions for AI-generated pull request titles and descriptions. {instructionsScope(machine.name)}
      </p>

      <PRInstructionsForm
        titleLoad={title.load}
        titleSave={title.save}
        descLoad={description.load}
        descSave={description.save}
      />
    </div>
  );
}
