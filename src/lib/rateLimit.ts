interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
  lastRequestAt: number;
}

const entries = new Map<string, RateLimitEntry>();
const windowMs = 60_000;
const cooldownMs = 1_500;
const requestLimit = 12;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const existing = entries.get(key);
  if (!existing || now - existing.windowStartedAt >= windowMs) {
    entries.set(key, { count: 1, windowStartedAt: now, lastRequestAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const sinceLast = now - existing.lastRequestAt;
  if (sinceLast < cooldownMs) return { allowed: false, retryAfterSeconds: Math.ceil((cooldownMs - sinceLast) / 1000) };
  if (existing.count >= requestLimit) return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - existing.windowStartedAt)) / 1000) };
  existing.count += 1;
  existing.lastRequestAt = now;
  if (entries.size > 500) {
    for (const [entryKey, entry] of entries) if (now - entry.windowStartedAt > windowMs) entries.delete(entryKey);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
