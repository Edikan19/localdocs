/**
 * Decide whether a WebSocket handshake should be accepted.
 * Browsers always send an Origin header, so a missing one is rejected.
 * Same-host connections are allowed; anything else must be allowlisted.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  allowedOrigins: string[] = [],
): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false; // malformed Origin header
  }
}