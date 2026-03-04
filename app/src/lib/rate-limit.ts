/**
 * In-memory rate limiter for API routes.
 *
 * ⚠️  LIMITATION: On Vercel serverless, each cold start gets a fresh Map,
 * so this only guards against bursts within a single instance lifetime.
 * It still catches rapid-fire abuse (bots, automated scripts) because
 * most Vercel instances persist for 5-15 minutes under load.
 *
 * For full protection, add Upstash Redis:
 *   npm i @upstash/ratelimit @upstash/redis
 * Then swap checkRateLimit to use Upstash's sliding window.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries periodically (only runs while instance is warm)
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (entry.resetAt < now) store.delete(key);
    });
  };
  // Use unref() so this doesn't keep the process alive in dev
  const timer = setInterval(cleanup, 5 * 60 * 1000);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}

export interface RateLimitConfig {
  /** Max requests in the window */
  max: number;
  /** Window size in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (usually IP + route).
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // Fresh window
    store.set(key, { count: 1, resetAt: now + config.windowSec * 1000 });
    return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowSec * 1000 };
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

/**
 * Extract client IP from request headers (works on Vercel + most proxies).
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Helper: apply rate limit and return a 429 response if exceeded.
 * Returns null if allowed (caller continues), or a Response if blocked.
 */
export function applyRateLimit(
  headers: Headers,
  route: string,
  config: RateLimitConfig
): Response | null {
  const ip = getClientIP(headers);
  const key = `${route}:${ip}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(config.max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}
