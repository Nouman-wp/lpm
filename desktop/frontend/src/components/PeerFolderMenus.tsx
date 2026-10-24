import { useState } from "react";
import { GroupContextMenu } from "./GroupContextMenu";
import { DeleteFolderDialog } from "./DeleteFolderDialog";
import { RenameModal } from "./RenameModal";
import { slotOf } from "../peer/hostFolders";
import { applyHostFolderOp, useHostFolderDialogs, useHostFolders } from "../peer/useHostFolders";

interface FolderRef {
  slug: string;
  id: string;
}

// The menu and the rename / new-folder / delete dialogs of a paired host's
// folders. Each change is one op the host applies to its own layout. Deleting a
// folder's projects stays with the host: from here a folder only lets go of them.
export function PeerFolderMenus() {
  const { menu, renaming, creating } = useHostFolderDialogs();
  const bySlug = useHostFolders((s) => s.bySlug);
  const [deleting, setDeleting] = useState<FolderRef | null>(null);
  const groupOf = (slug: string, id: string) => bySlug[slug]?.groups.find((g) => g.id === id);
  const menuGroup = menu ? groupOf(menu.slug, menu.id) : undefined;
  const renamingGroup = renaming ? groupOf(renaming.slug, renaming.id) : undefined;
  const deletingGroup = deleting ? groupOf(deleting.slug, deleting.id) : undefined;

  return (
    <>
      {menu && (
        <GroupContextMenu
          x={menu.x}
          y={menu.y}
          projectCount={menuGroup?.members.length ?? 0}
          onRename={() => useHostFolderDialogs.setState({ renaming: { slug: menu.slug, id: menu.id } })}
          onNewFolder={() => useHostFolderDialogs.setState({ creating: { slug: menu.slug } })}
          onDeleteFolder={() => setDeleting({ slug: menu.slug, id: menu.id })}
          onClose={() => useHostFolderDialogs.setState({ menu: null })}
        />
      )}
      <DeleteFolderDialog
        open={deletingGroup !== undefined}
        folderName={deletingGroup?.name ?? ""}
        projectCount={deletingGroup?.members.length ?? 0}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void applyHostFolderOp(deleting.slug, { op: "ungroup", id: deleting.id });
          setDeleting(null);
        }}
      />
      <RenameModal
        open={renaming !== null}
        title="Rename folder"
        initialValue={renamingGroup?.name ?? ""}
        onClose={() => useHostFolderDialogs.setState({ renaming: null })}
        onSubmit={(value) => {
          if (renaming) void applyHostFolderOp(renaming.slug, { op: "rename", id: renaming.id, name: value });
        }}
      />
      <RenameModal
        open={creating !== null}
        title="New folder"
        initialValue=""
        onClose={() => useHostFolderDialogs.setState({ creating: null })}
        onSubmit={(value) => {
          if (!creating) return;
          const folders = bySlug[creating.slug];
          const first = creating.members?.[0];
          void applyHostFolderOp(creating.slug, {
            op: "create",
            name: value,
            members: creating.members,
            before: folders && first ? slotOf(folders, first) : null,
          });
        }}
      />
    </>
  );
}
