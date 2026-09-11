/**
 * Resolve the app's public origin ("https://disctracker.digiarendus.ee") in
 * contexts where an absolute URL leaves the server (redirects, QR codes,
 * emails).
 *
 * Priority:
 *   1. X-Forwarded-Host + X-Forwarded-Proto — what a reverse proxy (Zone's
 *      Apache mod_proxy, nginx, Vercel, …) sends. Trusted because the app
 *      is only reachable through the proxy in prod, and using it means the
 *      redirect always lands on the same host the request came in on.
 *   2. Host header — last resort for direct requests (no proxy in front).
 *   3. NEXT_PUBLIC_APP_URL — explicit override. Deliberately LAST, not
 *      first: a stale build-time value used to silently override live
 *      request headers, which caused every check-in redirect to point at
 *      the wrong subdomain when the app moved from `digiarendus.ee` to
 *      `disctracker.digiarendus.ee`. Now the env var only kicks in when
 *      there's no request-derived origin at all (a Node script, a test).
 *
 * `req.url` is intentionally NOT used: Next.js reflects the internal
 * bind address there ("http://localhost:3000/…" behind a proxy), which is
 * exactly what we want to avoid.
 */
export function publicOriginFromRequest(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }

  const host = req.headers.get("host");
  if (host) {
    return `${forwardedProto ?? "http"}://${host}`;
  }

  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  return "http://localhost:3000";
}
