interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
  lastRequestAt: number;
}

const windowMs = 60_000;
const cooldownMs = 1_500;
const requestLimit = 12;
const maximumEntries = 5_000;
const cleanupIntervalMs = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class RateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private nextCleanupAt = 0;

  constructor(private readonly now: () => number = Date.now) {}

  check(key: string): RateLimitResult {
    const now = this.now();
    // Sweep before the new-key return, but at most once per interval even when
    // a full limiter receives a stream of different, rejected addresses.
    if (now >= this.nextCleanupAt) {
      for (const [entryKey, entry] of this.entries) {
        if (now - entry.windowStartedAt >= windowMs) this.entries.delete(entryKey);
      }
      this.nextCleanupAt = now + cleanupIntervalMs;
    }

    const existing = this.entries.get(key);
    if (!existing) {
      // Never evict an active client to admit a new key: that would let key
      // rotation bypass the per-client limits and keep growing server memory.
      if (this.entries.size >= maximumEntries) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((this.nextCleanupAt - now) / 1000)) };
      }
      this.entries.set(key, { count: 1, windowStartedAt: now, lastRequestAt: now });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (now - existing.windowStartedAt >= windowMs) {
      existing.count = 1;
      existing.windowStartedAt = now;
      existing.lastRequestAt = now;
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const sinceLast = now - existing.lastRequestAt;
    if (sinceLast < cooldownMs) return { allowed: false, retryAfterSeconds: Math.ceil((cooldownMs - sinceLast) / 1000) };
    if (existing.count >= requestLimit) return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - existing.windowStartedAt)) / 1000) };
    existing.count += 1;
    existing.lastRequestAt = now;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

const limiter = new RateLimiter();

export function checkRateLimit(key: string): RateLimitResult {
  return limiter.check(key);
}
