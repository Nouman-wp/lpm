import { DurableObject } from "cloudflare:workers";

// One shared recap card's image, kept for a year so the posts it's in keep
// their preview, then forgotten.
const KEEP_FOR_MS = 365 * 24 * 60 * 60 * 1000;
const KEY = "png";

export class RecapImage extends DurableObject {
  async put(png: ArrayBuffer): Promise<void> {
    await this.ctx.storage.put(KEY, png);
    await this.ctx.storage.setAlarm(Date.now() + KEEP_FOR_MS);
  }

  async png(): Promise<ArrayBuffer | undefined> {
    return this.ctx.storage.get<ArrayBuffer>(KEY);
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
