import { useMemo } from "react";
import { toast } from "sonner";
import { OpenFileInEditor, OpenPathInDefaultApp } from "../../bridge/commands";
import { basename } from "../path";
import { isPeerMarked, peerSlugOf } from "../peer/markers";
import { isEditable, noteReadOnlyCopy } from "../peer/readOnlyCopy";
import { trackPeerDownload } from "../peer/uploadProgress";
import { EDITOR_IDS, useOpenInTargets, type OpenInTarget } from "./useOpenInTargets";

export const DEFAULT_APP_ID = "__default_app__";
// Synthetic target injected after the editor list. Empty `icon` is a
// sentinel — OpenTargetIcon renders an inline SVG instead of an <img>.
const DEFAULT_APP_TARGET: OpenInTarget = {
  id: DEFAULT_APP_ID,
  label: "Default app",
  icon: "",
};

// The apps that can open one file. A file on a paired machine opens on this
// Mac, where a terminal or a file manager would have no folder of the file's
// to show.
export function useOpenFileTargets(absPath: string): OpenInTarget[] {
  const editorTargets = useOpenInTargets();
  const onPeer = isPeerMarked(absPath);
  return useMemo(
    () => [...editorTargets.filter((t) => !onPeer || EDITOR_IDS.has(t.id)), DEFAULT_APP_TARGET],
    [editorTargets, onPeer],
  );
}

export async function launchOpenFileTarget(t: OpenInTarget, absPath: string, line = 0, col = 0): Promise<void> {
  try {
    const opening =
      t.id === DEFAULT_APP_ID
        ? OpenPathInDefaultApp(absPath)
        : OpenFileInEditor(t.id, absPath, line, col, isEditable(absPath));
    const slug = peerSlugOf(absPath);
    const opened = await (slug ? trackPeerDownload(absPath, slug, basename(absPath), opening) : opening);
    noteReadOnlyCopy(absPath, opened);
  } catch (err) {
    toast.error(`Open in ${t.label}: ${err}`);
  }
}
