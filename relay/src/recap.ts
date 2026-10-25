import type { RecapImage } from "./recapStore";
import { newRecapId, RECAP_ID, RECAP_MAX_BYTES, recapPngProblem } from "./recapPng";

// lpm's weekly recap cards, posted to X, LinkedIn or a chat: lpm uploads the
// card when someone shares it, and the link it posts (lpm.cx/w/<id>) shows the
// card as its preview image, served from here.

export interface RecapEnv {
  RECAPS: DurableObjectNamespace<RecapImage>;
  RECAP_UPLOADS?: RateLimit;
}

export const RECAP_PATH = /^\/recap(?:\/([^/]+)\.png)?$/;
const PAGE = "https://lpm.cx/w/";

function headers(type: string, extra: Record<string, string> = {}): Headers {
  return new Headers({
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  });
}

async function upload(request: Request, env: RecapEnv, origin: string): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (env.RECAP_UPLOADS && !(await env.RECAP_UPLOADS.limit({ key: ip })).success) {
    return new Response("Too many uploads", { status: 429 });
  }
  if (Number(request.headers.get("Content-Length") ?? 0) > RECAP_MAX_BYTES) {
    return new Response("Too large", { status: 413 });
  }
  const png = await request.arrayBuffer();
  const problem = recapPngProblem(new Uint8Array(png));
  if (problem) return new Response(problem, { status: problem === "too large" ? 413 : 400 });
  const id = newRecapId();
  await env.RECAPS.get(env.RECAPS.idFromName(id)).put(png);
  const body = { id, url: `${PAGE}${id}`, image: `${origin}/recap/${id}.png` };
  return new Response(JSON.stringify(body), { status: 201, headers: headers("application/json") });
}

async function image(request: Request, env: RecapEnv, id: string, ctx: ExecutionContext): Promise<Response> {
  if (!RECAP_ID.test(id)) return new Response("Not found", { status: 404 });
  const cache = request.method === "GET" ? caches.default : null;
  const cached = await cache?.match(request);
  if (cached) return cached;
  const png = await env.RECAPS.get(env.RECAPS.idFromName(id)).png();
  if (!png) return new Response("Not found", { status: 404 });
  const response = new Response(png, {
    headers: headers("image/png", {
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "Cross-Origin-Resource-Policy": "cross-origin",
    }),
  });
  if (cache) ctx.waitUntil(cache.put(request, response.clone()));
  return response;
}

export function handleRecap(
  request: Request,
  env: RecapEnv,
  id: string | undefined,
  ctx: ExecutionContext,
): Promise<Response> | Response {
  const url = new URL(request.url);
  if (id === undefined && request.method === "POST") return upload(request, env, url.origin);
  if (id !== undefined && (request.method === "GET" || request.method === "HEAD")) {
    return image(request, env, id, ctx);
  }
  return new Response("Method not allowed", { status: 405 });
}
