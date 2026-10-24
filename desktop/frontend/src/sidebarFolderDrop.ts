// Folders dropped on the sidebar's project list become projects, filed into
// the folder header they land on.

export const FOLDER_DROP_ATTR = "data-sidebar-folder";

export const NOT_A_FOLDER = "Only folders can be projects";

export const dropOverlayLabel = (folder?: string) =>
  folder ? `Drop into ${folder}` : "Drop to add as project";

export function addedToast(labels: string[], folder?: string): string | null {
  if (labels.length === 0) return null;
  const what =
    labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? `${labels[0]} and ${labels[1]}`
        : `${labels.length} projects`;
  return folder ? `Added ${what} to ${folder}` : `Added ${what}`;
}
