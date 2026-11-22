type Entry = { count: number; resetAt: number };

/** Fixed-window limiter held in memory. Fine for a single server instance. */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, Entry>();

  return function check(key: string, now = Date.now()) {
    if (hits.size > 10_000) {
      for (const [k, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(k);
      }
    }

    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    entry.count++;
    if (entry.count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
      };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

// 10 sign-up or login attempts per address every 15 minutes
export const authLimiter = createRateLimiter(10, 15 * 60 * 1000);

/** Best-effort client address. Behind a proxy this comes from X-Forwarded-For. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || "unknown";
}