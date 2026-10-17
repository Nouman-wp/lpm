import type { main } from "../../../bridge/models";
import { MACHINE } from "../../machineWords";
import { Modal } from "../ui/Modal";
import { ImportReportList } from "./ImportReportList";
import { ImportReportSection } from "./ImportReportSection";

export function ImportReportModal({
  report,
  onClose,
}: {
  report: main.ImportReport | null;
  onClose: () => void;
}) {
  if (!report) return null;

  const { imported, skipped, missingRoots, missingTools } = report;
  const unportable: string[] = report.unportable ?? [];
  const nothingHappened = imported.length === 0 && skipped.length === 0;

  return (
    <Modal
      open
      onClose={onClose}
      zIndexClassName="z-[60]"
      contentClassName="w-[30rem] max-h-[80vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-xl"
    >
      <h3 className="text-base font-semibold text-[var(--text-primary)]">Import complete</h3>

      {nothingHappened && (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          The archive was read, but no projects were imported.
        </p>
      )}

      {imported.length > 0 && (
        <ImportReportSection title={`Imported (${imported.length})`} tone="good">
          <ImportReportList items={imported} />
        </ImportReportSection>
      )}

      {skipped.length > 0 && (
        <ImportReportSection
          title={`Skipped (${skipped.length})`}
          tone="warn"
          note="Already existed locally. Re-run with overwrite to replace them."
        >
          <ImportReportList items={skipped} />
        </ImportReportSection>
      )}

      {unportable.length > 0 && (
        <ImportReportSection
          title={`Not imported (${unportable.length})`}
          tone="warn"
          note={`Their names use characters ${MACHINE.thisMachine} can't have in a file name. Rename them where they came from, then export again.`}
        >
          <ImportReportList items={unportable} mono />
        </ImportReportSection>
      )}

      {missingRoots.length > 0 && (
        <ImportReportSection
          title={`Missing project folders (${missingRoots.length})`}
          tone="warn"
          note={`These projects reference folders that don't exist on ${MACHINE.thisMachine}. Clone or create them, then reopen the project.`}
        >
          <ul className="flex flex-col gap-1 text-xs font-mono">
            {missingRoots.map((mr: any) => (
              <li key={mr.project} className="rounded bg-[var(--bg-active)] px-2 py-0.5">
                <span className="text-[var(--text-primary)]">{mr.project}</span>
                <span className="text-[var(--text-muted)]"> → {mr.root}</span>
              </li>
            ))}
          </ul>
        </ImportReportSection>
      )}

      {missingTools.length > 0 && (
        <ImportReportSection
          title={`Missing tools (${missingTools.length})`}
          tone="warn"
          note="Referenced by project commands but not found in PATH. Install them to run the affected services/actions."
        >
          <ImportReportList items={missingTools} mono />
        </ImportReportSection>
      )}

      {report.backupPath && (
        <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--bg-active)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Previous config backed up to
          <div className="mt-0.5 break-all font-mono text-[var(--text-secondary)]">
            {report.backupPath}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
