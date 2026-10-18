import { useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "../../store/app";
import { SettingsSection } from "../SettingsSection";
import { BTN_SECONDARY } from "../ui/buttons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { NewTemplateModal } from "./NewTemplateModal";
import { useSettingsTarget } from "./settingsTarget";
import { TemplateRow } from "./TemplateRow";
import { useMachineTemplates } from "./useMachineTemplates";

// Runs a template change, saying when it fails; rethrows so a dialog can stay
// open for another try.
async function attempt(what: string, change: () => Promise<void>): Promise<void> {
  try {
    await change();
  } catch (err) {
    toast.error(`Failed to ${what} template: ${err}`);
    throw err;
  }
}

export function TemplatesPane() {
  const { templates: commands } = useSettingsTarget().commands;
  const templates = useMachineTemplates(commands);
  const selectTemplate = useAppStore((s) => s.selectTemplate);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [creatingTemplateBusy, setCreatingTemplateBusy] = useState(false);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<string | null>(null);

  return (
    <>
      <SettingsSection
        id="templates.list"
        description="Reusable sets of actions and terminals you can apply to multiple projects. Handy when several projects share a common setup — for example, one template for all your Rails apps."
      >
        {templates.length === 0 && !creatingTemplate && (
          <div className="px-4 py-3 text-[11px] text-[var(--text-muted)]">
            No templates yet.
          </div>
        )}
        {templates.map((name) => (
          <TemplateRow
            key={name}
            name={name}
            onEditConfig={() => selectTemplate(name)}
            onRename={(oldName, newName) =>
              oldName === newName ? Promise.resolve() : attempt("rename", () => commands.rename(oldName, newName))
            }
            onDelete={() => setConfirmDeleteTemplate(name)}
          />
        ))}
        <div className="flex items-center justify-end px-4 py-2.5">
          <button
            onClick={() => {
              setNewTemplateName("");
              setCreatingTemplate(true);
            }}
            className={BTN_SECONDARY}
          >
            New template
          </button>
        </div>
      </SettingsSection>

      <ConfirmDialog
        open={confirmDeleteTemplate !== null}
        title="Delete template"
        variant="destructive"
        confirmLabel="Delete"
        body={
          <>
            Delete{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {confirmDeleteTemplate}
            </span>
            ? Configs that <code>extends</code> this template will fail to load until the reference is removed.
          </>
        }
        onCancel={() => setConfirmDeleteTemplate(null)}
        onConfirm={() => {
          if (confirmDeleteTemplate) void attempt("delete", () => commands.remove(confirmDeleteTemplate)).catch(() => {});
          setConfirmDeleteTemplate(null);
        }}
      />

      <NewTemplateModal
        open={creatingTemplate}
        value={newTemplateName}
        busy={creatingTemplateBusy}
        onChange={setNewTemplateName}
        onCancel={() => setCreatingTemplate(false)}
        onSubmit={async () => {
          const name = newTemplateName.trim();
          if (!name || creatingTemplateBusy) return;
          setCreatingTemplateBusy(true);
          try {
            await attempt("create", () => commands.create(name));
            setCreatingTemplate(false);
            selectTemplate(name);
          } catch {
            // the modal stays open for another try
          } finally {
            setCreatingTemplateBusy(false);
          }
        }}
      />
    </>
  );
}
