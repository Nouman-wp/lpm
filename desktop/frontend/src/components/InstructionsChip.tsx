import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SOURCE_LABEL, type InstructionsTarget } from "../instructionSources";
import { useDismissOnEscape } from "../hooks/useDismissOnEscape";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { useAppStore } from "../store/app";
import { useInstructionsDialog, type InstructionsScope } from "../store/instructionsDialog";
import { displayNameForProjectName } from "./ProjectNameDisplay";
import { InstructionsInEffectPanel } from "./InstructionsInEffectPanel";
import { useProjectMachine } from "./settings/useProjectMachine";
import { useInstructionsInEffect } from "./useInstructionsInEffect";

interface InstructionsChipProps {
  projectName: string;
  target: InstructionsTarget;
  // The editor's back button tooltip, e.g. "Back to commit".
  backTitle: string;
}

// Which AI instructions are in effect for this project, with a way to edit
// them on top of the dialog the chip sits in.
export function InstructionsChip({ projectName, target, backTitle }: InstructionsChipProps) {
  const [open, setOpen] = useState(false);
  const machine = useProjectMachine(projectName);
  const inEffect = useInstructionsInEffect(projectName, target, machine.commands);
  const projectLabel = useAppStore((s) => displayNameForProjectName(projectName, s.projects));
  const show = useInstructionsDialog((s) => s.show);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false), open);
  useDismissOnEscape(open, () => setOpen(false));

  const edit = (scope: InstructionsScope) => {
    setOpen(false);
    // The editor hands focus back to whatever had it, so give it the chip
    // rather than a menu button about to unmount.
    buttonRef.current?.focus();
    show({ projectName, target, scope, backTitle });
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        Instructions:
        <span className="font-medium text-[var(--text-secondary)]">
          {inEffect ? SOURCE_LABEL[inEffect.source] : "…"}
        </span>
        <ChevronDown size={11} />
      </button>
      {open && inEffect && (
        <InstructionsInEffectPanel projectLabel={projectLabel} inEffect={inEffect} onEdit={edit} />
      )}
    </div>
  );
}
