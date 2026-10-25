import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "../notifications/toast";
import { FileExists } from "../../bridge/commands";
import { registerFileDropHandler } from "../fileDrop";
import { composerDragActive } from "./useComposerDragMove";
import { useAppStore } from "../store/app";
import type { AdoptedProject } from "../store/adoptProject";
import { displayNameForProjectName } from "../components/ProjectNameDisplay";
import { FOLDER_DROP_ATTR, NOT_A_FOLDER, addedToast } from "../sidebarFolderDrop";
import type { ProjectGroup } from "../types";

export interface SidebarDropHover {
  list: DOMRect;
  folder: { name: string; rect: DOMRect } | null;
}

interface SidebarFolderDropOptions {
  groups: ProjectGroup[];
  onMoveProjectsToGroup: (names: string[], groupId: string | null) => void | Promise<void>;
  onOpen: (name: string) => void;
}

interface DropTarget {
  folder: HTMLElement | null;
  folderId: string | null;
}

// Only what is on top at the point counts, so a menu or dialog over the list
// takes its own drops.
function dropTargetAt(list: HTMLElement | null, x: number, y: number): DropTarget | null {
  const top = document.elementFromPoint(x, y);
  if (!list || !top || !list.contains(top)) return null;
  const folder = top.closest<HTMLElement>(`[${FOLDER_DROP_ATTR}]`);
  return { folder, folderId: folder?.getAttribute(FOLDER_DROP_ATTR) ?? null };
}

// Folders dragged in from the file manager become projects the way the +
// picker's Local folder does, filed into the folder header they land on.
export function useSidebarFolderDrop(
  listRef: RefObject<HTMLElement | null>,
  options: SidebarFolderDropOptions,
): SidebarDropHover | null {
  const [hover, setHover] = useState<SidebarDropHover | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let dragActive = false;
    let lastKey: string | null = null;
    const folderName = (id: string | null) =>
      id ? optionsRef.current.groups.find((g) => g.id === id)?.name : undefined;
    const clear = () => {
      dragActive = false;
      lastKey = null;
      setHover(null);
    };
    const onEnter = () => {
      dragActive = true;
    };
    const onOver = (e: Event) => {
      if (!dragActive || composerDragActive()) return;
      const [x, y] = (e as CustomEvent<[number, number]>).detail ?? [];
      if (typeof x !== "number" || typeof y !== "number") return;
      const target = dropTargetAt(listRef.current, x, y);
      const name = folderName(target?.folderId ?? null);
      const key = target ? (name ? `folder:${target.folderId}` : "list") : null;
      if (key === lastKey) return;
      lastKey = key;
      const list = listRef.current;
      setHover(
        target && list
          ? {
              list: list.getBoundingClientRect(),
              folder:
                name && target.folder ? { name, rect: target.folder.getBoundingClientRect() } : null,
            }
          : null,
      );
    };
    window.addEventListener("app:handleDragEnter", onEnter);
    window.addEventListener("app:handleDragOver", onOver);
    window.addEventListener("app:handleDragLeave", clear);
    window.addEventListener("app:filesDropped", clear);
    return () => {
      window.removeEventListener("app:handleDragEnter", onEnter);
      window.removeEventListener("app:handleDragOver", onOver);
      window.removeEventListener("app:handleDragLeave", clear);
      window.removeEventListener("app:filesDropped", clear);
    };
  }, [listRef]);

  useEffect(
    () =>
      registerFileDropHandler("sidebar-projects", (x, y, paths) => {
        if (paths.length === 0 || composerDragActive()) return false;
        const target = dropTargetAt(listRef.current, x, y);
        if (!target) return false;
        void addFolders(paths, target.folderId, optionsRef.current);
        return true;
      }),
    [listRef],
  );

  return hover;
}

async function addFolders(
  paths: string[],
  folderId: string | null,
  { groups, onMoveProjectsToGroup, onOpen }: SidebarFolderDropOptions,
) {
  const isFile = await Promise.all(paths.map((p) => FileExists(p).catch(() => false)));
  const dirs = paths.filter((_, i) => !isFile[i]);
  if (dirs.length < paths.length) toast.error(NOT_A_FOLDER);
  const added: AdoptedProject[] = [];
  for (const dir of dirs) {
    const adopted = await useAppStore.getState().addLocalFolder(dir);
    if (adopted) added.push(adopted);
  }
  if (added.length === 0) return;
  const folder = folderId ? groups.find((g) => g.id === folderId) : undefined;
  if (folder) await onMoveProjectsToGroup(added.map((a) => a.name), folder.id);
  const fresh = added.filter((a) => !a.existing);
  const projects = useAppStore.getState().projects;
  const text = addedToast(
    fresh.map((a) => displayNameForProjectName(a.name, projects)),
    folder?.name,
  );
  if (!text) return;
  toast.success(
    text,
    fresh.length === 1
      ? { action: { label: "Open", onClick: () => onOpen(fresh[0].name) } }
      : undefined,
  );
}
