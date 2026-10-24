import { RefreshIcon, StopIcon } from "../icons";
import { ContextMenuItem } from "../ui/ContextMenuItem";
import { ContextMenuShell } from "../ui/ContextMenuShell";
import { PortLinkMenuItems } from "./PortLinkMenuItems";

interface ServiceTabContextMenuProps {
  x: number;
  y: number;
  // The ports the service's links point at; empty until it binds when its
  // config names none (or always, for SSH projects).
  ports: number[];
  // The project the service belongs to, which says whose localhost it is on.
  projectName: string;
  service: string;
  // The pane the tab is in, where a Browser tab for it opens.
  paneId: string;
  onRestart: () => void;
  onStop: () => void;
  onClose: () => void;
}

export function ServiceTabContextMenu({ x, y, ports, projectName, service, paneId, onRestart, onStop, onClose }: ServiceTabContextMenuProps) {
  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      <PortLinkMenuItems
        projectName={projectName}
        links={ports.map((port) => ({ port, service }))}
        paneId={paneId}
        emptyHint="No port detected yet"
        onClose={onClose}
      />
      <ContextMenuItem
        label="Restart service"
        icon={<RefreshIcon />}
        onClick={() => {
          onRestart();
          onClose();
        }}
      />
      <ContextMenuItem
        label="Stop service"
        icon={<StopIcon />}
        destructive
        onClick={() => {
          onStop();
          onClose();
        }}
      />
    </ContextMenuShell>
  );
}
