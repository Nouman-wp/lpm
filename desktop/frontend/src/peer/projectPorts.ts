import { toast } from "sonner";
import { PeerPortForward, SetClipboardText } from "../../bridge/commands";
import { BrowserOpenURL } from "../../bridge/runtime";
import { peerSlugOf } from "./markers";

const LOOPBACK_URL = /^(https?:\/\/)(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)(.*)$/i;

// The port on this Mac that reaches a project's `port`: the same one for this
// Mac's projects, a local port tunnelled to the machine (porttunnel.rs) for a
// paired one's.
export async function projectLocalPort(projectName: string, port: number): Promise<number> {
  const slug = peerSlugOf(projectName);
  return slug ? Number(await PeerPortForward(slug, port)) : port;
}

export async function projectPortUrl(projectName: string, port: number): Promise<string> {
  return `http://localhost:${await projectLocalPort(projectName, port)}`;
}

// Open a project's web server in the default browser, saying why when it can't
// be reached.
export async function openProjectPort(projectName: string, port: number): Promise<void> {
  try {
    BrowserOpenURL(await projectPortUrl(projectName, port));
  } catch (err) {
    toast.error(`Couldn't open :${port}: ${err}`);
  }
}

// The address this Mac reaches a project's web server at, on the clipboard.
export async function copyProjectPortUrl(projectName: string, port: number): Promise<void> {
  try {
    const url = await projectPortUrl(projectName, port);
    await SetClipboardText(url);
    toast.success(`Copied ${url}`);
  } catch (err) {
    toast.error(`Couldn't copy :${port}: ${err}`);
  }
}

// An address typed into a project's browser: a paired machine's project means
// that machine's localhost.
export async function projectAddress(projectName: string, url: string): Promise<string> {
  const m = LOOPBACK_URL.exec(url);
  if (!m || !peerSlugOf(projectName)) return url;
  const [, scheme, port, rest] = m;
  return `${scheme}localhost:${await projectLocalPort(projectName, Number(port))}${rest}`;
}
