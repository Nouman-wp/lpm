import { DurableObject } from "cloudflare:workers";

// One shared tab's room. Its host (lpm on the sharing machine) holds one socket and
// each browser guest holds another. What they send each other is Noise ciphertext
// this never reads: it only adds or strips the 8-byte id that tells the host which
// guest a message is from or for. Hibernation keeps an idle room free.

const HOST = "host";
const GUEST = "guest";
const ID_BYTES = 8;
const MAX_GUESTS = 16;
// The largest Noise message, plus the id.
const MAX_MESSAGE = 65535 + ID_BYTES;
const FORGET_AFTER_MS = 24 * 60 * 60 * 1000;
const OPEN = 1;

// Why a guest's socket closed; relay/public/app.js reads these.
const CLOSE = {
  replaced: 4000,
  hostLeft: 4001,
  closedByHost: 4003,
  offline: 4004,
  ended: 4010,
  full: 4029,
  tooBig: 1009,
} as const;

type Attachment = { role: typeof HOST } | { role: typeof GUEST; id: string };

const guestTag = (id: string) => `c:${id}`;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));
}

async function sha256(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

function close(ws: WebSocket, code: number, reason: string) {
  try {
    ws.close(code, reason);
  } catch {}
}

function upgraded(client: WebSocket): Response {
  return new Response(null, { status: 101, webSocket: client });
}

export class Room extends DurableObject<object> {
  constructor(ctx: DurableObjectState, env: object) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    if (await this.ctx.storage.get("ended")) return this.refuse(CLOSE.ended, "sharing ended");
    return new URL(request.url).pathname.endsWith("/host") ? this.host(request) : this.guest();
  }

  private openHost(): WebSocket | undefined {
    return this.ctx.getWebSockets(HOST).find((ws) => ws.readyState === OPEN);
  }

  // The first host to arrive claims the room with its token; only that token
  // takes it back after a reconnect.
  private async host(request: Request): Promise<Response> {
    const token = /^Bearer (\S+)$/.exec(request.headers.get("Authorization") ?? "")?.[1];
    if (!token) return new Response("Unauthorized", { status: 401 });
    const hash = await sha256(token);
    const claimed = await this.ctx.storage.get<string>("host");
    if (claimed && claimed !== hash) return new Response("Forbidden", { status: 403 });
    if (!claimed) await this.ctx.storage.put("host", hash);
    await this.ctx.storage.deleteAlarm();
    for (const ws of this.ctx.getWebSockets(HOST)) close(ws, CLOSE.replaced, "replaced");
    // Their sessions lived in the connection that just went away.
    for (const ws of this.ctx.getWebSockets(GUEST)) close(ws, CLOSE.hostLeft, "host reconnected");
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [HOST]);
    server.serializeAttachment({ role: HOST } satisfies Attachment);
    return upgraded(client);
  }

  private refuse(code: number, reason: string): Response {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    close(server, code, reason);
    return upgraded(client);
  }

  private guest(): Response {
    const host = this.openHost();
    if (!host) return this.refuse(CLOSE.offline, "host offline");
    if (this.ctx.getWebSockets(GUEST).length >= MAX_GUESTS) return this.refuse(CLOSE.full, "room is full");
    const [client, server] = Object.values(new WebSocketPair());
    const id = toHex(crypto.getRandomValues(new Uint8Array(ID_BYTES)));
    this.ctx.acceptWebSocket(server, [GUEST, guestTag(id)]);
    server.serializeAttachment({ role: GUEST, id } satisfies Attachment);
    host.send(JSON.stringify({ t: "open", c: id }));
    return upgraded(client);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const from = ws.deserializeAttachment() as Attachment;
    if (typeof message !== "string" && message.byteLength > MAX_MESSAGE) {
      close(ws, CLOSE.tooBig, "message too big");
      return;
    }
    if (from.role === HOST) {
      if (typeof message === "string") await this.command(message);
      else this.toGuest(message);
      return;
    }
    if (typeof message === "string") return;
    const host = this.openHost();
    if (!host) {
      close(ws, CLOSE.offline, "host offline");
      return;
    }
    const out = new Uint8Array(ID_BYTES + message.byteLength);
    out.set(fromHex(from.id));
    out.set(new Uint8Array(message), ID_BYTES);
    host.send(out);
  }

  private toGuest(message: ArrayBuffer) {
    if (message.byteLength <= ID_BYTES) return;
    const id = toHex(new Uint8Array(message, 0, ID_BYTES));
    for (const ws of this.ctx.getWebSockets(guestTag(id))) ws.send(message.slice(ID_BYTES));
  }

  private async command(text: string) {
    let v: { t?: unknown; c?: unknown };
    try {
      v = JSON.parse(text);
    } catch {
      return;
    }
    if (v.t === "close" && typeof v.c === "string") {
      for (const ws of this.ctx.getWebSockets(guestTag(v.c))) close(ws, CLOSE.closedByHost, "closed");
    } else if (v.t === "end") {
      for (const ws of this.ctx.getWebSockets()) close(ws, CLOSE.ended, "sharing ended");
      // Kept a while so an old invite says it ended rather than that the host is away.
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.put("ended", true);
      await this.ctx.storage.setAlarm(Date.now() + FORGET_AFTER_MS);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    close(ws, 1000, "bye");
    await this.left(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.left(ws);
  }

  private async left(ws: WebSocket) {
    const who = ws.deserializeAttachment() as Attachment | null;
    if (!who) return;
    if (who.role === GUEST) {
      this.openHost()?.send(JSON.stringify({ t: "close", c: who.id }));
      return;
    }
    if (this.ctx.getWebSockets(HOST).some((h) => h !== ws && h.readyState === OPEN)) return;
    for (const g of this.ctx.getWebSockets(GUEST)) close(g, CLOSE.offline, "host offline");
    if (await this.ctx.storage.get("host")) await this.ctx.storage.setAlarm(Date.now() + FORGET_AFTER_MS);
  }

  // A room that ended, or whose host never came back, is forgotten.
  async alarm(): Promise<void> {
    if (!this.openHost()) await this.ctx.storage.deleteAll();
  }
}
