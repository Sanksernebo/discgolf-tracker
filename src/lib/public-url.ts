/**
 * Resolve the app's public origin ("https://digiarendus.ee") in contexts
 * where an absolute URL leaves the server (redirects, QR codes, emails).
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL — explicit override, wins everywhere.
 *   2. X-Forwarded-Host + X-Forwarded-Proto — what a reverse proxy (Zone's
 *      Apache mod_proxy, nginx, Vercel, …) sends. Trusted because the app
 *      is only reachable through the proxy in prod.
 *   3. Host header — last resort, correct only when there is no proxy.
 *
 * `req.url` is intentionally NOT used: Next.js reflects the internal
 * bind address there ("http://localhost:3000/…" behind a proxy), which is
 * exactly what we want to avoid.
 */
export function publicOriginFromRequest(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }

  const host = req.headers.get("host") ?? "localhost:3000";
  return `${forwardedProto ?? "http"}://${host}`;
}
