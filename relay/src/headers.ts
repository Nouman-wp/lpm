// Whoever controls this page's scripts can type into a host's terminal, so it
// loads nothing from anywhere else and can't be framed.
export function withSecurityHeaders(response: Response, url: URL): Response {
  const headers = new Headers(response.headers);
  const sockets = url.protocol === "https:" ? `wss://${url.host}` : `ws://${url.host}`;
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      "script-src 'self'",
      // xterm.js themes the terminal through a style element of its own.
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data:",
      `connect-src 'self' ${sockets}`,
      "manifest-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
