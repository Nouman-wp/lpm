import { toast } from "../../notifications/toast";
import { AddPortForward } from "../../../bridge/commands";
import { projectPortUrl } from "../../peer/projectPorts";
import { openPortInLpm } from "../../portLinks";

// localPort=0 leaves the choice to the backend (mirrors the remote port
// when free, picks a free one otherwise).
export async function forwardPortAndOpen(
  projectName: string,
  remotePort: number,
  localPort = 0,
): Promise<void> {
  try {
    const pf = await AddPortForward(projectName, remotePort, localPort);
    const url = await projectPortUrl(projectName, pf.localPort);
    toast.success(`Forwarded :${remotePort} → ${url}`);
    openPortInLpm(projectName, pf.localPort);
  } catch (err) {
    toast.error(`Forward :${remotePort}: ${err}`);
  }
}
