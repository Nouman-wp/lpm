import { useEffect, useMemo, useState } from "react";
import { DetectServicePorts } from "../../bridge/commands";
import { linkedPorts, parseServicePorts } from "../servicePorts";
import { PortLinkMenuItems, type PortLink } from "./terminal/PortLinkMenuItems";

interface RunningService {
  name: string;
  port: number;
}

interface OpenInBrowserSubmenuProps {
  projectName: string;
  running: boolean;
  services: RunningService[];
  onClose: () => void;
}

// Each running service's web server, in lpm's Browser tab or the default
// browser — a paired machine's through a port tunnelled from there. The
// configured `port:` renders the rows synchronously so the menu has its final
// height on the first frame (no async reflow / flicker); live detection then
// refines each service to the port it actually bound.
export function OpenInBrowserSubmenu({ projectName, running, services, onClose }: OpenInBrowserSubmenuProps) {
  const [detected, setDetected] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (!running) {
      setDetected({});
      return;
    }
    let cancelled = false;
    DetectServicePorts(projectName)
      .then((res) => {
        if (!cancelled) setDetected(parseServicePorts(res));
      })
      .catch(() => {
        // Detection is best-effort; the configured ports still drive the menu.
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, running]);

  const links = useMemo<PortLink[]>(() => {
    const out: PortLink[] = [];
    for (const svc of services) {
      for (const port of linkedPorts(detected[svc.name] ?? [], svc.port, true)) {
        out.push({ service: svc.name, port });
      }
    }
    return out;
  }, [services, detected]);

  if (!running) return null;
  return <PortLinkMenuItems projectName={projectName} links={links} onClose={onClose} />;
}
