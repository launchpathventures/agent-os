/**
 * Voice Dedup Cache (Brief 180)
 *
 * In-memory cache for voice guidance computes. Dedupes repeat requests
 * for the same (sessionId, transcriptHash) inside a short TTL window so
 * back-to-back client triggers do not each spawn a fresh LLM call.
 *
 * Also tracks per-session keys so transcript flush can invalidate all
 * cached entries for a session in one call.
 *
 * This is a process-local cache — it does not survive restarts and does
 * not span instances. For voice traffic this is acceptable: a dropped
 * cache entry is at worst one duplicate compute, not a correctness issue.
 *
 * Provenance: Stripe idempotency-key pattern (see brief §Provenance)
 */

import { createHash } from "crypto";
import type { VoiceEvaluation } from "./network-chat";

type CacheValue = VoiceEvaluation & { etag: string };

interface CacheEntry {
  key: string;
  sessionId: string;
  value: CacheValue;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5_000;
const MAX_ENTRIES = 1_000;

const store = new Map<string, CacheEntry>();
const sessionIndex = new Map<string, Set<string>>();
// Shared in-flight promises: when two concurrent requests hit with the same
// (sessionId, transcriptHash), the second attaches to the first's pending
// compute instead of running a duplicate LLM call. Keyed by cacheKey.
const inFlight = new Map<string, Promise<CacheValue | null>>();
// Per-session generation counter. Bumped by invalidate(); compared by
// runOrJoin() before its trailing set() so a compute that started before an
// invalidation cannot re-insert stale data with a fresh TTL.
const sessionGen = new Map<string, number>();

const stats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  writes: 0,
  inFlightHits: 0,
};

function now(): number {
  return Date.now();
}

function purgeExpired(): void {
  const t = now();
  for (const [k, entry] of store) {
    if (entry.expiresAt <= t) {
      removeEntry(k);
    }
  }
}

function removeEntry(key: string): void {
  const entry = store.get(key);
  if (!entry) return;
  store.delete(key);
  const bucket = sessionIndex.get(entry.sessionId);
  if (bucket) {
    bucket.delete(key);
    if (bucket.size === 0) sessionIndex.delete(entry.sessionId);
  }
}

function enforceCapacity(): void {
  if (store.size <= MAX_ENTRIES) return;
  // LRU-ish: drop the oldest entries (Map preserves insertion order).
  const overflow = store.size - MAX_ENTRIES;
  let dropped = 0;
  for (const key of store.keys()) {
    if (dropped >= overflow) break;
    removeEntry(key);
    dropped += 1;
  }
}

/**
 * Deterministic hash of the last-N transcript turns for a session.
 *
 * Includes sessionId so identical transcripts from different sessions
 * do not collide. Uses SHA-256 truncated to 16 hex chars — collision
 * probability is negligible for the cache TTL.
 */
export function hashTranscript(input: {
  sessionId: string;
  lastN: Array<{ role: string; content: string }>;
}): string {
  const h = createHash("sha256");
  h.update(input.sessionId);
  h.update("|");
  for (const turn of input.lastN) {
    h.update(turn.role);
    h.update(":");
    h.update(turn.content);
    h.update("\n");
  }
  return h.digest("hex").slice(0, 16);
}

/**
 * Stable ETag derived from sessionId, learned keys, and the turn index.
 * Used by the guidance route to return 304 when state has not advanced.
 */
export function buildGuidanceETag(input: {
  sessionId: string;
  learned: Record<string, string | null> | null | undefined;
  lastTurnIndex: number;
}): string {
  const learnedStable = input.learned
    ? Object.keys(input.learned)
        .sort()
        .map((k) => `${k}=${input.learned?.[k] ?? ""}`)
        .join("&")
    : "";
  const h = createHash("sha256");
  h.update(input.sessionId);
  h.update("|");
  h.update(String(input.lastTurnIndex));
  h.update("|");
  h.update(learnedStable);
  return `"${h.digest("hex").slice(0, 20)}"`;
}

function cacheKey(sessionId: string, transcriptHash: string): string {
  return `${sessionId}:${transcriptHash}`;
}

export interface VoiceDedup {
  get(sessionId: string, transcriptHash: string): CacheValue | undefined;
  set(sessionId: string, transcriptHash: string, value: CacheValue, ttlMs?: number): void;
  /**
   * Execute `compute` for (sessionId, transcriptHash), sharing the promise
   * with any concurrent caller for the same key. On success the value is
   * cached with TTL; on failure the in-flight slot is cleared so the next
   * caller can retry. Prevents thundering-herd LLM calls when the client
   * no longer throttles pushes.
   */
  runOrJoin(
    sessionId: string,
    transcriptHash: string,
    compute: () => Promise<CacheValue | null>,
    ttlMs?: number,
  ): Promise<{ value: CacheValue | null; joined: boolean }>;
  invalidate(sessionId: string): number;
  size(): number;
  stats(): Readonly<typeof stats>;
  clear(): void;
}

export const voiceDedup: VoiceDedup = {
  get(sessionId, transcriptHash) {
    const key = cacheKey(sessionId, transcriptHash);
    const entry = store.get(key);
    if (!entry) {
      stats.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= now()) {
      removeEntry(key);
      stats.misses += 1;
      return undefined;
    }
    stats.hits += 1;
    return entry.value;
  },
  set(sessionId, transcriptHash, value, ttlMs = DEFAULT_TTL_MS) {
    purgeExpired();
    const key = cacheKey(sessionId, transcriptHash);
    const entry: CacheEntry = {
      key,
      sessionId,
      value,
      expiresAt: now() + ttlMs,
    };
    store.set(key, entry);
    let bucket = sessionIndex.get(sessionId);
    if (!bucket) {
      bucket = new Set();
      sessionIndex.set(sessionId, bucket);
    }
    bucket.add(key);
    stats.writes += 1;
    enforceCapacity();
  },
  async runOrJoin(sessionId, transcriptHash, compute, ttlMs = DEFAULT_TTL_MS) {
    const key = cacheKey(sessionId, transcriptHash);
    const existing = inFlight.get(key);
    if (existing) {
      stats.inFlightHits += 1;
      const value = await existing;
      return { value, joined: true };
    }
    const startGen = sessionGen.get(sessionId) ?? 0;
    const ref: { p?: Promise<CacheValue | null> } = {};
    const promise = (async () => {
      try {
        const value = await compute();
        // Skip the trailing set() if an invalidate() bumped the generation
        // while compute was running — otherwise we'd re-insert stale data
        // with a fresh 5s TTL.
        if (value && (sessionGen.get(sessionId) ?? 0) === startGen) {
          this.set(sessionId, transcriptHash, value, ttlMs);
        }
        return value;
      } finally {
        // Clear only if still ours (invalidate may have already cleared it).
        if (inFlight.get(key) === ref.p) inFlight.delete(key);
      }
    })();
    ref.p = promise;
    inFlight.set(key, promise);
    const value = await promise;
    return { value, joined: false };
  },
  invalidate(sessionId) {
    const bucket = sessionIndex.get(sessionId);
    // Bump generation so any in-progress compute's trailing set() is skipped.
    sessionGen.set(sessionId, (sessionGen.get(sessionId) ?? 0) + 1);
    // Also drop any in-flight promises for this session so a subsequent
    // caller starts fresh against the advanced state.
    for (const key of Array.from(inFlight.keys())) {
      if (key.startsWith(`${sessionId}:`)) inFlight.delete(key);
    }
    if (!bucket) return 0;
    const count = bucket.size;
    for (const key of bucket) store.delete(key);
    sessionIndex.delete(sessionId);
    stats.invalidations += count;
    return count;
  },
  size() {
    return store.size;
  },
  stats() {
    return stats;
  },
  clear() {
    store.clear();
    sessionIndex.clear();
    inFlight.clear();
    sessionGen.clear();
    stats.hits = 0;
    stats.misses = 0;
    stats.invalidations = 0;
    stats.writes = 0;
    stats.inFlightHits = 0;
  },
};
