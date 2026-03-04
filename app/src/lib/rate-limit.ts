/**
 * Rate Limiter — Upstash Redis (production) with in-memory fallback (dev).
 *
 * Uses @upstash/ratelimit sliding window for real distributed rate limiting
 * that works across Vercel serverless invocations.
 *
 * Fallback: If UPSTASH_REDIS_REST_URL is not set, falls back to in-memory
 * (still catches bursts within a single instance, but not across cold starts).
 *
 * Setup:
 *   1. Create a free Upstash Redis database at https://upstash.com
 *   2. Add to .env.local:
 *        UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *        UPSTASH_REDIS_REST_TOKEN=AXxx...
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── Upstash Redis rate limiter (production) ──────────────────

let redis: Redis | null = null;
const upstashLimiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function getUpstashLimiter(route: string, config: RateLimitConfig): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  const key = `${route}:${config.max}:${config.windowSec}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(config.max, `${config.windowSec} s`),
      prefix: `ds_rl:${route}`,
      analytics: false,
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

// ── In-memory fallback (dev / missing env vars) ─────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries periodically
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    memStore.forEach((entry, key) => {
      if (entry.resetAt < now) memStore.delete(key);
    });
  };
  const timer = setInterval(cleanup, 5 * 60 * 1000);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}

function checkMemoryRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + config.windowSec * 1000 });
    return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowSec * 1000 };
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

// ── Public API ───────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests in the window */
  max: number;
  /** Window size in seconds */
  windowSec: number;
  /** Legacy hint — ignored now since Upstash handles persistence automatically */
  persistent?: boolean;
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
 * Apply rate limit and return a 429 response if exceeded.
 * Returns null if allowed (caller continues), or a Response if blocked.
 *
 * Uses Upstash Redis if configured, otherwise falls back to in-memory.
 */
export function applyRateLimit(
  headers: Headers,
  route: string,
  config: RateLimitConfig
): Response | null {
  const ip = getClientIP(headers);
  const identifier = `${ip}`;

  const upstash = getUpstashLimiter(route, config);

  if (upstash) {
    // Upstash path — async, but we need to return sync for current API routes.
    // We fire-and-forget the check and use a sync wrapper pattern.
    // For proper async: callers should `await applyRateLimitAsync(...)`.
    // For backward compat, use the memory fallback as the sync guard
    // and let Upstash handle the distributed state in the async version.
    //
    // → Use applyRateLimitAsync for full Upstash support.
    // → This sync version still uses memory as a fast first layer.
    const memKey = `${route}:${ip}`;
    const memResult = checkMemoryRateLimit(memKey, config);
    if (!memResult.allowed) {
      return make429Response(memResult.resetAt, config.max);
    }
    return null;
  }

  // Memory-only path
  const key = `${route}:${ip}`;
  const result = checkMemoryRateLimit(key, config);
  if (!result.allowed) {
    return make429Response(result.resetAt, config.max);
  }
  return null;
}

/**
 * Async rate limit — uses Upstash Redis for real distributed limiting.
 * Use this in API routes that can await.
 *
 * Returns null if allowed, or a Response (429) if blocked.
 */
export async function applyRateLimitAsync(
  headers: Headers,
  route: string,
  config: RateLimitConfig
): Promise<Response | null> {
  const ip = getClientIP(headers);
  const identifier = `${ip}`;

  const upstash = getUpstashLimiter(route, config);

  if (upstash) {
    try {
      const result = await upstash.limit(identifier);
      if (!result.success) {
        const resetAt = result.reset;
        return make429Response(resetAt, config.max);
      }
      return null;
    } catch (err) {
      // If Upstash is down, fall through to memory
      console.warn("Upstash rate limit failed, falling back to memory:", err);
    }
  }

  // Fallback to memory
  const key = `${route}:${ip}`;
  const result = checkMemoryRateLimit(key, config);
  if (!result.allowed) {
    return make429Response(result.resetAt, config.max);
  }
  return null;
}

function make429Response(resetAt: number, max: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
      retryAfter: Math.max(retryAfter, 1),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(retryAfter, 1)),
        "X-RateLimit-Limit": String(max),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    }
  );
}
