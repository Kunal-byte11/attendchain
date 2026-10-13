/**
 * Lightweight, in-memory sliding-window rate limiter (NFR-005, 05_SECURITY.md).
 * Uses a token bucket / timestamp-array approach for deterministic request throttling.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

const rateLimitBuckets = new Map<string, number[]>();

/**
 * Checks and increments the rate limit counter for a given client identifier (IP or Wallet).
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const cutoff = now - windowMs;

  const timestamps = rateLimitBuckets.get(identifier) || [];
  // Filter out timestamps outside the active sliding window
  const validTimestamps = timestamps.filter((t) => t > cutoff);

  if (validTimestamps.length >= config.maxRequests) {
    const oldestTimestamp = validTimestamps[0] ?? now;
    const resetSeconds = Math.max(
      1,
      Math.ceil((oldestTimestamp + windowMs - now) / 1000)
    );

    rateLimitBuckets.set(identifier, validTimestamps);
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetSeconds,
    };
  }

  validTimestamps.push(now);
  rateLimitBuckets.set(identifier, validTimestamps);

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - validTimestamps.length,
    resetSeconds: config.windowSeconds,
  };
}

/**
 * Resets rate limit buckets (useful for test isolation).
 */
export function resetRateLimitBuckets(): void {
  rateLimitBuckets.clear();
}
