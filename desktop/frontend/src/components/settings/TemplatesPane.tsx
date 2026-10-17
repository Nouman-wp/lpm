import { useState } from "react";
import { useAppStore } from "../../store/app";
import { SettingsSection } from "../SettingsSection";
import { BTN_SECONDARY } from "../ui/buttons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { NewTemplateModal } from "./NewTemplateModal";
import { TemplateRow } from "./TemplateRow";

export function TemplatesPane() {
  const templates = useAppStore((s) => s.templates);
  const selectTemplate = useAppStore((s) => s.selectTemplate);
  const createTemplate = useAppStore((s) => s.createTemplate);
  const removeTemplate = useAppStore((s) => s.removeTemplate);
  const renameTemplate = useAppStore((s) => s.renameTemplate);
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
        {templates.map((tmpl) => (
          <TemplateRow
            key={tmpl.name}
            name={tmpl.name}
            onEditConfig={() => selectTemplate(tmpl.name)}
            onRename={renameTemplate}
            onDelete={() => setConfirmDeleteTemplate(tmpl.name)}
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
          if (confirmDeleteTemplate) removeTemplate(confirmDeleteTemplate);
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
            await createTemplate(name);
            setCreatingTemplate(false);
          } catch {
            // toast surfaced by store; modal stays open for retry
          } finally {
            setCreatingTemplateBusy(false);
          }
        }}
      />
    </>
  );
}
