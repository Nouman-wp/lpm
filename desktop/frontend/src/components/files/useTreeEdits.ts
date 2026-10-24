import { useCallback, useMemo, useRef, useState } from "react";
import { CreateProjectEntry, RenameProjectEntry } from "../../../bridge/commands";
import { basename } from "../../path";
import { useAppStore } from "../../store/app";
import { entryNameProblem } from "./entryName";
import type { NameEditView } from "./FilesNameInput";
import { trashLater, usePendingTrashPaths } from "./trashQueue";
import {
  DRAFT_PATH,
  isUnder,
  nameTarget,
  namesIn,
  renamedPath,
  type NameEdit,
} from "./treeEdits";
import { ancestorsOf, parentPath, type Item, type Listing } from "./treeModel";

export const SSH_EDIT_BLOCKED = "Files on an SSH host can't be changed from here yet";

interface TreeEditsOptions {
  root: string;
  projectName: string;
  listings: ReadonlyMap<string, Listing>;
  load: (dir: string) => Promise<void>;
  // What puts a folder's row on screen, open, for a new entry to go in.
  expandDirs: (dirs: string[]) => void;
  setQuery: (query: string) => void;
  showChangesOnly: (on: boolean) => void;
  openFile: (path: string) => void;
  selectedPath: string | null;
  dirtyPaths: ReadonlySet<string>;
}

export interface TreeEdits {
  edit: NameEdit | null;
  view: NameEditView | null;
  pending: readonly string[];
  // Why the tree can't be changed here; null when it can.
  blocked: string | null;
  create: (dir: string, isDir: boolean) => void;
  rename: (item: Item) => void;
  trash: (item: Item) => void;
}

// New file, new folder, rename and Move to Trash in the Files tree. A name is
// typed into the tree itself and checked as it is typed; a trashed entry hides
// at once and goes after the Undo window.
export function useTreeEdits({
  root,
  projectName,
  listings,
  load,
  expandDirs,
  setQuery,
  showChangesOnly,
  openFile,
  selectedPath,
  dirtyPaths,
}: TreeEditsOptions): TreeEdits {
  const onSsh = useAppStore((s) => s.projects.find((p) => p.name === projectName)?.isRemote ?? false);
  const blocked = onSsh ? SSH_EDIT_BLOCKED : null;
  const pending = usePendingTrashPaths(root);
  const [edit, setEdit] = useState<NameEdit | null>(null);
  const [name, setName] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const editRef = useRef(edit);
  editRef.current = edit;

  const folder = edit ? (edit.kind === "create" ? edit.dir : parentPath(edit.path)) : "";
  const current = edit?.kind === "rename" ? basename(edit.path) : null;
  const siblings = useMemo(() => namesIn(listings, folder), [listings, folder]);
  const problemOf = useCallback(
    (typed: string) => entryNameProblem(typed.trim(), siblings, current),
    [siblings, current],
  );

  const begin = useCallback((next: NameEdit, initial: string) => {
    setEdit(next);
    setName(initial);
    setFailure(null);
  }, []);

  const create = useCallback(
    (dir: string, isDir: boolean) => {
      if (blocked) return;
      setQuery("");
      showChangesOnly(false);
      if (dir) expandDirs([...ancestorsOf(dir), dir]);
      begin({ kind: "create", dir, isDir }, "");
    },
    [blocked, setQuery, showChangesOnly, expandDirs, begin],
  );

  const rename = useCallback(
    (item: Item) => {
      if (!blocked) begin({ kind: "rename", path: item.path, isDir: item.isDir }, basename(item.path));
    },
    [blocked, begin],
  );

  const cancel = useCallback(() => {
    setEdit(null);
    setFailure(null);
  }, []);

  const commit = useCallback(
    async (typed: string) => {
      const target = editRef.current;
      if (!target || busyRef.current) return;
      const clean = typed.trim();
      if (clean === "" || clean === current) return cancel();
      if (problemOf(clean)) return;
      if (target.kind === "rename" && [...dirtyPaths].some((p) => isUnder(p, target.path))) {
        setFailure("Save or discard the unsaved edits first");
        return;
      }
      const path = nameTarget(target, clean);
      busyRef.current = true;
      setBusy(true);
      try {
        if (target.kind === "create") await CreateProjectEntry(root, path, target.isDir);
        else await RenameProjectEntry(root, target.path, path);
        await load(folder);
      } catch (err: unknown) {
        setFailure(String(err));
        return;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
      setEdit(null);
      if (target.kind === "create" && !target.isDir) openFile(path);
      const moved = target.kind === "rename" && selectedPath ? renamedPath(selectedPath, target.path, path) : null;
      if (moved) openFile(moved);
    },
    [root, current, folder, problemOf, dirtyPaths, load, openFile, selectedPath, cancel],
  );

  // Clicking away keeps a good name and drops a blank or broken one.
  const blur = useCallback(
    (typed: string) => {
      if (!editRef.current || busyRef.current) return;
      if (typed.trim() === "" || problemOf(typed)) cancel();
      else void commit(typed);
    },
    [problemOf, commit, cancel],
  );

  const trash = useCallback(
    (item: Item) => {
      if (!blocked) trashLater(root, item.path, () => load(parentPath(item.path)));
    },
    [blocked, root, load],
  );

  const view = useMemo<NameEditView | null>(() => {
    if (!edit) return null;
    return {
      path: edit.kind === "create" ? DRAFT_PATH : edit.path,
      initial: edit.kind === "rename" ? basename(edit.path) : "",
      isDir: edit.isDir,
      problem: failure ?? (name.trim() === "" ? null : problemOf(name)),
      busy,
      onChange: (next) => {
        setName(next);
        setFailure(null);
      },
      onCommit: (typed) => void commit(typed),
      onBlur: blur,
      onCancel: cancel,
    };
  }, [edit, failure, name, problemOf, busy, commit, blur, cancel]);

  return { edit, view, pending, blocked, create, rename, trash };
}
