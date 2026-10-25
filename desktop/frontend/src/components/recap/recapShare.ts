import {
  CopyPngImage,
  SavePngImage,
  SharePngImage,
  UploadRecapImage,
} from "../../../bridge/commands";
import { BrowserOpenURL } from "../../../bridge/runtime";
import { recapImage } from "./recapImage";
import { recapCaption, type RecapView } from "./weeklyRecapModel";

export type RecapNetwork = "x" | "linkedin";

interface RecapLink {
  url: string;
  image: string;
}

const COMPOSE: Record<RecapNetwork, (caption: string, url: string) => string> = {
  x: (caption, url) =>
    `https://x.com/intent/post?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(url)}`,
  // LinkedIn turns the link in the text into the card's preview.
  linkedin: (caption, url) =>
    `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(`${caption} ${url}`)}`,
};

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image"));
    reader.readAsDataURL(blob);
  });
}

const fileName = (view: RecapView) => `My week in lpm ${view.range}`;

/** Copies the card as a PNG. The clipboard write starts before the image is
 *  drawn so it stays tied to the click; a webview that refuses it hands the
 *  image to the backend instead. */
export async function copyRecapImage(view: RecapView): Promise<void> {
  const image = recapImage(view);
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
      return;
    } catch {
      // Refused: fall through to the backend.
    }
  }
  await CopyPngImage(await base64(await image));
}

/** Saves the card to Downloads; returns where. */
export async function saveRecapImage(view: RecapView): Promise<string> {
  return SavePngImage(await base64(await recapImage(view)), fileName(view));
}

/** Hands the card to the system share sheet, pointing from `from`. */
export async function shareRecapImage(view: RecapView, from: DOMRect): Promise<void> {
  const anchor = { x: from.x, y: from.y, width: from.width, height: from.height };
  await SharePngImage(await base64(await recapImage(view)), fileName(view), anchor);
}

// One upload per card: posting it twice, or to both networks, reuses the
// first link.
const links = new Map<string, Promise<RecapLink>>();

function recapLink(view: RecapView): Promise<RecapLink> {
  const key = JSON.stringify(view);
  let link = links.get(key);
  if (!link) {
    link = recapImage(view)
      .then(base64)
      .then((png) => UploadRecapImage(png) as Promise<RecapLink>);
    link.catch(() => links.delete(key));
    links.set(key, link);
  }
  return link;
}

/** Opens a new post with the caption and the card's link, which the network
 *  shows as the card itself. */
export async function postRecap(view: RecapView, network: RecapNetwork): Promise<void> {
  const { url } = await recapLink(view);
  BrowserOpenURL(COMPOSE[network](recapCaption(view), url));
}
