import { Room } from "./room";
import { withSecurityHeaders } from "./headers";

export { Room };

// The share relay: a browser joins a tab someone shared in lpm, through a room
// only that share's invite names. The page it joins from is served here too, on
// an origin of its own, away from lpm.cx and its analytics.

interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace<Room>;
  CONNECTS?: RateLimit;
}

const ROOM_PATH = /^\/room\/([A-Za-z0-9_-]{22})\/(host|guest)$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const room = ROOM_PATH.exec(url.pathname);
    if (!room) return withSecurityHeaders(await env.ASSETS.fetch(request), url);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    // Guests come from this relay's own page; nobody else's site gets to use it.
    if (room[2] === "guest" && request.headers.get("Origin") !== url.origin) {
      return new Response("Forbidden", { status: 403 });
    }
    const ip = request.headers.get("CF-Connecting-IP") ?? "";
    if (env.CONNECTS && !(await env.CONNECTS.limit({ key: ip })).success) {
      return new Response("Too many connections", { status: 429 });
    }
    return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(request);
  },
} satisfies ExportedHandler<Env>;
