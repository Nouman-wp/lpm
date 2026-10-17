import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListOpenInTargets, OpenIn } from "../../bridge/commands";
import { main } from "../../bridge/models";
import { isPeerMarked } from "../peer/markers";

export type OpenInTarget = main.OpenInTarget;

export const OPEN_IN_SELECTED_KEY = "lpm.openIn.selectedId";

export const EDITOR_IDS = new Set([
  "cursor", "vscode", "vscode-insiders", "windsurf", "zed", "xcode", "sublime-text", "webstorm", "typora",
  "intellij-idea", "pycharm", "goland", "rustrover", "clion", "phpstorm", "rubymine", "rider",
]);

export function primaryOpenInTarget(targets: OpenInTarget[]): OpenInTarget | null {
  if (targets.length === 0) return null;
  const id = localStorage.getItem(OPEN_IN_SELECTED_KEY) ?? "";
  return targets.find((t) => t.id === id) ?? targets[0];
}

// The apps that can open a project folder. A project on a paired machine opens
// here only in an editor that reaches it over SSH, and only when this Mac
// reaches that machine over SSH at all; an SSH project only in such an editor.
export function projectOpenInTargets(
  targets: OpenInTarget[],
  projectPath: string,
  { isRemote = false, peerViaSsh = false }: { isRemote?: boolean; peerViaSsh?: boolean },
): OpenInTarget[] {
  const onPeer = isPeerMarked(projectPath);
  return targets.filter((t) => {
    if (t.fileOnly) return false;
    if (onPeer) return peerViaSsh && !isRemote && t.remoteCapable;
    return !isRemote || t.remoteCapable;
  });
}

let cache: OpenInTarget[] | null = null;

export function useOpenInTargets() {
  const [targets, setTargets] = useState<OpenInTarget[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    ListOpenInTargets().then((list) => {
      cache = list;
      setTargets(list);
    }).catch(() => {});
  }, []);
  return targets;
}

export async function launchOpenInTarget(t: OpenInTarget, projectPath: string) {
  // Launching an app makes it the last-used one, so every entry point (sidebar
  // "Open with", the toolbar dropdown) surfaces it as the default next time —
  // primaryOpenInTarget reads this key.
  localStorage.setItem(OPEN_IN_SELECTED_KEY, t.id);
  try {
    await OpenIn(t.id, projectPath);
  } catch (err) {
    toast.error(`Open in ${t.label}: ${err}`);
  }
}
