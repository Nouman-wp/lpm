import { useEffect, useRef, useState } from "react";
import { toast } from "../../../notifications/toast";
import { Modal } from "../../ui/Modal";
import { AIPickerButton } from "../../ui/AIPickerButton";
import { SparkleIcon, XIcon } from "../../icons";
import { TransformText } from "../../../../bridge/commands";
import { useAIPicker } from "../../../hooks/useAIPicker";
import { isCanceledError, useAIGeneration } from "../../../hooks/useAIGeneration";
import {
  CHECK_IDEAS,
  CHECK_INSTRUCTION,
  checkRequest,
  cleanCheckCommand,
} from "../../../jobsCheckAI";
import { aiEffectiveFast } from "../../../types";
import { enterHint } from "../../../shortcutHints";
import { CheckCommandInput } from "./CheckCommandInput";

// Describe when a job has work in plain words; the AI writes the check command,
// which can be tried and tweaked here before it goes into the job. `task` is
// what the job does, handed to the AI as context.
export function CheckAIModal({
  open,
  project,
  task,
  aiProject,
  aiCwd,
  onClose,
  onUse,
}: {
  open: boolean;
  project: string | undefined;
  task: string;
  aiProject: string | undefined;
  aiCwd: string;
  onClose: () => void;
  onUse: (command: string) => void;
}) {
  const [want, setWant] = useState("");
  const [command, setCommand] = useState<string | null>(null);
  const gen = useAIGeneration(aiProject ?? aiCwd);
  const ai = useAIPicker(open, aiProject ?? aiCwd);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setWant("");
    setCommand(null);
    const timer = setTimeout(() => textareaRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open]);

  const generate = async () => {
    if (!want.trim() || gen.generating) return;
    try {
      const out = await gen.run((genId) =>
        TransformText(
          aiProject ?? null,
          aiCwd,
          ai.selectedCLI,
          ai.selectedModel,
          ai.selectedEffort,
          aiEffectiveFast(ai.selectedCLI, ai.selectedModel, ai.selectedFast),
          CHECK_INSTRUCTION,
          checkRequest(want, task),
          genId,
        ),
      );
      const next = cleanCheckCommand(typeof out === "string" ? out : "");
      if (!next) {
        toast.error("AI returned an empty response");
        return;
      }
      setCommand(next);
    } catch (err) {
      if (!isCanceledError(err)) toast.error(`Couldn't generate the check: ${err}`);
    }
  };

  const close = () => {
    gen.cancel();
    onClose();
  };

  const canUse = !!command?.trim() && !gen.generating;
  const use = () => {
    if (!canUse || !command) return;
    onUse(command.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      backdropClassName="bg-black/60 backdrop-blur-sm"
      contentClassName="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
      zIndexClassName="z-[60]"
    >
      <div className="flex w-[min(560px,calc(100vw-32px))] flex-col">
        <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              <span className="text-[var(--text-secondary)]">
                <SparkleIcon />
              </span>
              <h2 className="text-[16px] font-semibold leading-tight tracking-tight">
                Generate the check with AI
              </h2>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-5 text-[var(--text-muted)]">
              Say when the job has work to do. AI writes a command that succeeds
              only then{task ? ", with what the automation does as context" : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <XIcon />
          </button>
        </header>

        <div className="space-y-3 px-6">
          <div
            className={`rounded-xl transition-all ${
              gen.generating
                ? "p-[1px] [background:conic-gradient(from_var(--gradient-angle),#6366f1,#a855f7,#ec4899,#06b6d4,#6366f1)] animate-[gradient-spin_3s_linear_infinite]"
                : "border border-[var(--border)] focus-within:border-[var(--text-muted)]"
            }`}
          >
            <div className="rounded-[calc(0.75rem-1px)] bg-[var(--bg-secondary)]">
              <textarea
                ref={textareaRef}
                aria-label="When the automation has work"
                value={want}
                onChange={(e) => setWant(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void generate();
                  }
                }}
                placeholder="e.g. when the upstream branch has commits I haven't pulled"
                rows={3}
                disabled={gen.generating}
                className="block w-full resize-none rounded-[calc(0.75rem-1px)] bg-transparent px-4 py-3 text-[13.5px] leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:opacity-60"
              />
            </div>
          </div>

          {!want.trim() && command === null && (
            <div className="flex flex-wrap gap-1.5">
              {CHECK_IDEAS.map((idea) => (
                <button
                  key={idea.label}
                  type="button"
                  onClick={() => {
                    setWant(idea.want);
                    textareaRef.current?.focus();
                  }}
                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {idea.label}
                </button>
              ))}
            </div>
          )}

          {command !== null && (
            <div className="field-reveal space-y-2 pt-1">
              <div className="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Command
              </div>
              <CheckCommandInput
                value={command}
                project={project}
                disabled={gen.generating}
                onChange={setCommand}
                onSubmit={use}
              />
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 px-6 pb-5 pt-5">
          <span className="text-[11px] text-[var(--text-muted)]">
            <kbd className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-1 py-px font-mono text-[10px]">
              {enterHint({ meta: true })}
            </kbd>{" "}
            to generate
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
            {ai.anyAvailable ? (
              <AIPickerButton
                onGenerate={() => void generate()}
                onCancel={gen.cancel}
                generating={gen.generating}
                disabled={!want.trim()}
                title={`Generate with ${ai.cliLabel}`}
                label={command === null ? "Generate" : "Regenerate"}
                generatingLabel="Generating…"
                aiCLIs={ai.aiCLIs}
                selectedCLI={ai.selectedCLI}
                selectedModel={ai.selectedModel}
                selectedEffort={ai.selectedEffort}
                selectedFast={ai.selectedFast}
                onSelect={ai.selectAI}
                onSelectEffort={ai.selectEffort}
                onSelectFast={ai.selectFast}
                menuPlacement="up"
              />
            ) : (
              <span className="text-[11px] text-[var(--text-muted)]">
                No AI CLI detected
              </span>
            )}
            {command !== null && (
              <button
                type="button"
                onClick={use}
                disabled={!canUse}
                className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--bg-primary)] shadow-sm transition hover:opacity-90 disabled:opacity-40 disabled:shadow-none"
              >
                Use command
              </button>
            )}
          </div>
        </footer>
      </div>
    </Modal>
  );
}
