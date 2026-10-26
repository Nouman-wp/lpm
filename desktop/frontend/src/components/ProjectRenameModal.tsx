import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "./ui/Modal";
import { ChevronRightIcon, FolderIcon } from "./icons";
import { RemoteFolderBrowserModal } from "./RemoteFolderBrowserModal";
import { FolderMoveNotice } from "./FolderMoveNotice";
import { BrowseFolder } from "../../bridge/commands";
import { modalInputDefaults } from "../forms/styles";
import { basename, folderName, isAbsolutePath, joinPath } from "../path";
import { isWindowsHostPath } from "../peer/markers";
import { isWindows } from "../platform";
import { useFolderMoveBlock } from "../hooks/useFolderMoveBlock";
import { folderMoveError, folderMoveTarget, isFolderMoveBlocked } from "../renameFolderText";

interface ProjectRenameModalProps {
  open: boolean;
  projectName: string;
  displayName: string;
  currentRoot: string;
  canRenameFolder: boolean;
  running: boolean;
  // The paired machine the project is on. `currentRoot` is then its path there,
  // and the folder is browsed and moved there.
  host?: { slug: string; alias: string };
  // What the other projects beside it show as, so two can't end up the same.
  takenNames: string[];
  onClose: () => void;
  onRenameLabel: (value: string) => void;
  onMoveFolder: (newRoot: string) => Promise<void>;
}

export function ProjectRenameModal({
  open,
  projectName,
  displayName,
  currentRoot,
  canRenameFolder,
  running,
  host,
  takenNames,
  onClose,
  onRenameLabel,
  onMoveFolder,
}: ProjectRenameModalProps) {
  const [label, setLabel] = useState(displayName);
  const [expanded, setExpanded] = useState(false);
  const [root, setRoot] = useState(currentRoot);
  const [submitting, setSubmitting] = useState(false);
  const [browsingHost, setBrowsingHost] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(displayName);
    setExpanded(false);
    setRoot(currentRoot);
    setSubmitting(false);
    setBrowsingHost(false);
    setMoveError(null);
    requestAnimationFrame(() => {
      labelRef.current?.focus();
      labelRef.current?.select();
    });
  }, [open, displayName, currentRoot]);

  const win = host ? isWindowsHostPath(currentRoot) : isWindows;
  const folderBlock = useFolderMoveBlock(projectName, running, open && canRenameFolder);
  const folderBusy = isFolderMoveBlocked(folderBlock.block);

  useEffect(() => {
    if (!expanded || folderBusy) return;
    requestAnimationFrame(() => {
      const el = rootRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(currentRoot.length - basename(currentRoot, win).length, currentRoot.length);
    });
  }, [expanded, folderBusy, currentRoot, win]);

  const labelTrim = label.trim();
  const labelChanged = labelTrim.length > 0 && labelTrim !== displayName.trim();
  const labelTaken =
    labelChanged && takenNames.some((n) => n.trim().toLowerCase() === labelTrim.toLowerCase());
  const rootTrim = root.trim();
  const looksAbsolute = isAbsolutePath(rootTrim, win);
  const rootEdited = looksAbsolute && rootTrim !== currentRoot.trim();
  const folderChanged = expanded && canRenameFolder && !folderBusy && rootEdited;
  const target = folderMoveTarget(rootTrim, win);
  const canSubmit = !submitting && !labelTaken && (labelChanged || folderChanged);

  const editRoot = (value: string) => {
    setRoot(value);
    setMoveError(null);
  };
  const moveInto = (parent: string) => editRoot(joinPath(parent, folderName(currentRoot, win), win));

  const browse = async () => {
    if (host) {
      setBrowsingHost(true);
      return;
    }
    const parent = await BrowseFolder();
    if (parent) moveInto(parent);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (folderChanged) {
      setSubmitting(true);
      setMoveError(null);
      try {
        await onMoveFolder(rootTrim);
      } catch (err) {
        setMoveError(folderMoveError(err));
        setSubmitting(false);
        return;
      }
    }
    if (labelChanged) onRenameLabel(labelTrim);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      zIndexClassName="z-[60]"
      contentClassName="w-[400px] max-w-[calc(100vw-32px)] rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 shadow-2xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Rename project
        </h3>
        <input
          ref={labelRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          {...modalInputDefaults}
          aria-invalid={labelTaken}
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-base text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)]"
        />
        {labelTaken && (
          <p role="alert" className="mt-1.5 pl-0.5 text-[11px] text-[var(--accent-red-text)]">
            Another project is already called “{labelTrim}”.
          </p>
        )}

        {canRenameFolder && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            >
              <span
                className={`flex items-center transition-transform [&>svg]:h-3 [&>svg]:w-3 ${
                  expanded ? "rotate-90" : ""
                }`}
              >
                <ChevronRightIcon />
              </span>
              Rename folder on disk
            </button>

            {expanded && (
              <div className="mt-2">
                {folderBusy ? (
                  <FolderMoveNotice
                    block={folderBlock.block}
                    clearing={folderBlock.clearing}
                    onClear={() => void folderBlock.clear()}
                  />
                ) : (
                  <>
                    <div className="relative">
                      <input
                        ref={rootRef}
                        value={root}
                        onChange={(e) => editRoot(e.target.value)}
                        {...modalInputDefaults}
                        placeholder="Folder location"
                        className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-3 pr-9 font-mono text-[12px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)]"
                      />
                      <button
                        type="button"
                        onClick={browse}
                        title="Choose parent folder"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      >
                        <FolderIcon />
                      </button>
                    </div>
                    {rootEdited ? (
                      <p
                        className="mt-1.5 truncate pl-0.5 font-mono text-[11px] text-[var(--text-muted)]"
                        title={`${currentRoot} → ${rootTrim}`}
                      >
                        {currentRoot} → {target.dir}
                        <span className="font-semibold text-[var(--text-primary)]">{target.name}</span>
                      </p>
                    ) : (
                      <p className="mt-1.5 pl-0.5 text-[11px] text-[var(--text-muted)]">
                        Moves the folder on {host ? host.alias : "your computer"}.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {moveError && (
          <p
            role="alert"
            className="mt-4 select-text break-words rounded-lg bg-[color-mix(in_srgb,var(--accent-red)_12%,var(--bg-primary))] px-3 py-2 text-[12px] leading-snug text-[var(--accent-red-text)]"
          >
            {moveError}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-[var(--text-primary)] px-4 py-1.5 text-sm font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-85 disabled:opacity-30"
          >
            {submitting ? "Moving…" : "Save"}
          </button>
        </div>
      </form>
      {host && (
        <RemoteFolderBrowserModal
          open={browsingHost}
          slug={host.slug}
          alias={host.alias}
          title="Choose parent folder"
          confirmLabel="Move here"
          onChoose={(parent) => {
            setBrowsingHost(false);
            moveInto(parent);
          }}
          onClose={() => setBrowsingHost(false)}
        />
      )}
    </Modal>
  );
}
