import { Room } from "./room";
import { RecapImage } from "./recapStore";
import { handleRecap, RECAP_PATH, type RecapEnv } from "./recap";
import { withSecurityHeaders } from "./headers";

export { Room, RecapImage };

// The share relay: a browser joins a tab someone shared in lpm, through a room
// only that share's invite names. The page it joins from is served here too, on
// an origin of its own, away from lpm.cx and its analytics. It also keeps the
// weekly recap cards people post (recap.ts).

interface Env extends RecapEnv {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace<Room>;
  CONNECTS?: RateLimit;
}

const ROOM_PATH = /^\/room\/([A-Za-z0-9_-]{22})\/(host|guest)$/;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const recap = RECAP_PATH.exec(url.pathname);
    if (recap) return handleRecap(request, env, recap[1], ctx);
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
