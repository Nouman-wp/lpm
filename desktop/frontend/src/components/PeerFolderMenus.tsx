import { GroupContextMenu } from "./GroupContextMenu";
import { RenameModal } from "./RenameModal";
import { slotOf } from "../peer/hostFolders";
import { applyHostFolderOp, useHostFolderDialogs, useHostFolders } from "../peer/useHostFolders";

// The menu and the rename / new-folder dialogs of a paired host's folders. Each
// change is one op the host applies to its own layout. Deleting a folder's
// projects stays with the host: from here a folder only lets go of them.
export function PeerFolderMenus() {
  const { menu, renaming, creating } = useHostFolderDialogs();
  const bySlug = useHostFolders((s) => s.bySlug);
  const groupOf = (slug: string, id: string) => bySlug[slug]?.groups.find((g) => g.id === id);
  const menuGroup = menu ? groupOf(menu.slug, menu.id) : undefined;
  const renamingGroup = renaming ? groupOf(renaming.slug, renaming.id) : undefined;
  const ungroup =
    menu && menuGroup ? () => void applyHostFolderOp(menu.slug, { op: "ungroup", id: menu.id }) : undefined;
  const hasMembers = Boolean(menuGroup?.members.length);

  return (
    <>
      {menu && (
        <GroupContextMenu
          x={menu.x}
          y={menu.y}
          onRename={() => useHostFolderDialogs.setState({ renaming: { slug: menu.slug, id: menu.id } })}
          onNewFolder={() => useHostFolderDialogs.setState({ creating: { slug: menu.slug } })}
          onUngroup={hasMembers ? ungroup : undefined}
          onDelete={hasMembers ? undefined : ungroup}
          onClose={() => useHostFolderDialogs.setState({ menu: null })}
        />
      )}
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
