import { GlobeIcon, RefreshIcon, StopIcon } from "../icons";
import { ContextMenuItem } from "../ui/ContextMenuItem";
import { ContextMenuShell } from "../ui/ContextMenuShell";
import { ContextMenuSubmenu } from "../ui/ContextMenuSubmenu";
import { openProjectPort } from "../../peer/projectPorts";

interface ServiceTabContextMenuProps {
  x: number;
  y: number;
  // Live ports the service is listening on; empty until it binds (or always,
  // for remote projects) — drives whether "Open in browser" is actionable.
  ports: number[];
  // The project the service belongs to, which says whose localhost it is on.
  projectName: string;
  onRestart: () => void;
  onStop: () => void;
  onClose: () => void;
}

const portLabel = (port: number) => (
  <span className="font-mono text-[10px] tabular-nums">{`:${port}`}</span>
);

export function ServiceTabContextMenu({ x, y, ports, projectName, onRestart, onStop, onClose }: ServiceTabContextMenuProps) {
  const open = (port: number) => {
    void openProjectPort(projectName, port);
    onClose();
  };
  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      {ports.length > 1 ? (
        <ContextMenuSubmenu label="Open in browser" icon={<GlobeIcon />}>
          {ports.map((port) => (
            <ContextMenuItem
              key={port}
              label={`localhost:${port}`}
              onClick={() => open(port)}
            />
          ))}
        </ContextMenuSubmenu>
      ) : (
        <ContextMenuItem
          label="Open in browser"
          icon={<GlobeIcon />}
          trailing={ports.length === 1 ? portLabel(ports[0]) : undefined}
          disabled={ports.length === 0}
          title={ports.length === 0 ? "No port detected yet" : undefined}
          onClick={() => open(ports[0])}
        />
      )}
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
