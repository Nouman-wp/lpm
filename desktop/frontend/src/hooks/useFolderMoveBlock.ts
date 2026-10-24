import { useCallback, useEffect, useState } from "react";
import { ListProjectTerminals, StopTerminal } from "../../bridge/commands";
import { useAppStore } from "../store/app";
import type { FolderMoveBlock } from "../renameFolderText";

const TAB_DROP_WAIT_MS = 1000;

async function terminalIds(projectName: string): Promise<string[]> {
  const listed: unknown = await ListProjectTerminals(projectName).catch(() => []);
  if (!Array.isArray(listed)) return [];
  return listed
    .map((t) => (t as { id?: unknown } | null)?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

// The store holds one tab removal at a time; wait for the project's view to
// take it before asking for the next.
function tabDropTaken(): Promise<void> {
  return new Promise((resolve) => {
    if (!useAppStore.getState().pendingRemoveTerminal) return resolve();
    const done = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(done, TAB_DROP_WAIT_MS);
    const unsubscribe = useAppStore.subscribe((s) => {
      if (!s.pendingRemoveTerminal) done();
    });
  });
}

// Stop the services, end each terminal's process tree, then drop its tab the
// way a tab whose terminal already ended is dropped.
async function stopAndClose(projectName: string): Promise<void> {
  const store = useAppStore.getState();
  if (store.projects.find((p) => p.name === projectName)?.running) {
    await store.stopProject(projectName);
  }
  const ids = await terminalIds(projectName);
  await Promise.all(ids.map((id) => StopTerminal(id).catch(() => {})));
  for (const id of ids) {
    useAppStore.getState().removeRemoteTerminal(id);
    await tabDropTaken();
  }
}

// What keeps a project's folder from moving, and the way to clear it from the
// rename dialog without losing what was typed there.
export function useFolderMoveBlock(projectName: string, running: boolean, active: boolean) {
  const [terminals, setTerminals] = useState(0);
  const [clearing, setClearing] = useState(false);

  const recount = useCallback(async () => {
    setTerminals((await terminalIds(projectName)).length);
  }, [projectName]);

  useEffect(() => {
    if (!active || !projectName) return;
    setTerminals(0);
    void recount();
  }, [active, projectName, recount]);

  const clear = useCallback(async () => {
    setClearing(true);
    try {
      await stopAndClose(projectName);
    } finally {
      await recount();
      setClearing(false);
    }
  }, [projectName, recount]);

  const block: FolderMoveBlock = { running, terminals };
  return { block, clearing, clear };
}
