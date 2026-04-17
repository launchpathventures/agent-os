/**
 * Unit tests for Brief 180 voice-context primitives.
 *
 * Scope: the pure, DB-free primitives that back the voice guidance pipeline.
 * Integration coverage (real DB, real LLM-mock path) lives in
 * `voice-push.e2e.test.ts`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  hashTranscript,
  buildGuidanceETag,
  voiceDedup,
} from "./voice-dedup";
import type { VoiceEvaluation } from "./network-chat";

const sampleEval = (overrides: Partial<VoiceEvaluation> = {}): VoiceEvaluation => ({
  learned: { name: "Jane" },
  guidance: "Ask about the business.",
  stage: "gathering",
  validateRewrote: false,
  ...overrides,
});

describe("voice-dedup — hashTranscript", () => {
  it("produces stable output for identical input", () => {
    const a = hashTranscript({
      sessionId: "s1",
      lastN: [{ role: "user", content: "hi" }, { role: "assistant", content: "hey" }],
    });
    const b = hashTranscript({
      sessionId: "s1",
      lastN: [{ role: "user", content: "hi" }, { role: "assistant", content: "hey" }],
    });
    expect(a).toBe(b);
  });

  it("differs when a turn changes", () => {
    const a = hashTranscript({
      sessionId: "s1",
      lastN: [{ role: "user", content: "hi" }],
    });
    const b = hashTranscript({
      sessionId: "s1",
      lastN: [{ role: "user", content: "HI" }],
    });
    expect(a).not.toBe(b);
  });

  it("differs when sessionId changes", () => {
    const a = hashTranscript({ sessionId: "s1", lastN: [{ role: "user", content: "hi" }] });
    const b = hashTranscript({ sessionId: "s2", lastN: [{ role: "user", content: "hi" }] });
    expect(a).not.toBe(b);
  });
});

describe("voice-dedup — buildGuidanceETag", () => {
  it("is deterministic for identical inputs", () => {
    const a = buildGuidanceETag({ sessionId: "s1", learned: { name: "Jane" }, lastTurnIndex: 3 });
    const b = buildGuidanceETag({ sessionId: "s1", learned: { name: "Jane" }, lastTurnIndex: 3 });
    expect(a).toBe(b);
  });

  it("changes when learned keys change", () => {
    const a = buildGuidanceETag({ sessionId: "s1", learned: { name: "Jane" }, lastTurnIndex: 3 });
    const b = buildGuidanceETag({ sessionId: "s1", learned: { name: "Jane", business: "Acme" }, lastTurnIndex: 3 });
    expect(a).not.toBe(b);
  });

  it("changes when lastTurnIndex advances", () => {
    const a = buildGuidanceETag({ sessionId: "s1", learned: {}, lastTurnIndex: 3 });
    const b = buildGuidanceETag({ sessionId: "s1", learned: {}, lastTurnIndex: 4 });
    expect(a).not.toBe(b);
  });

  it("is stable regardless of learned key order", () => {
    const a = buildGuidanceETag({
      sessionId: "s1",
      learned: { name: "Jane", business: "Acme" },
      lastTurnIndex: 3,
    });
    const b = buildGuidanceETag({
      sessionId: "s1",
      learned: { business: "Acme", name: "Jane" },
      lastTurnIndex: 3,
    });
    expect(a).toBe(b);
  });

  it("is a quoted string per HTTP ETag semantics", () => {
    const t = buildGuidanceETag({ sessionId: "s1", learned: {}, lastTurnIndex: 1 });
    expect(t.startsWith("\"")).toBe(true);
    expect(t.endsWith("\"")).toBe(true);
  });
});

describe("voice-dedup — cache get/set/invalidate", () => {
  beforeEach(() => {
    voiceDedup.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    voiceDedup.clear();
  });

  it("returns undefined on cache miss", () => {
    expect(voiceDedup.get("s1", "hashA")).toBeUndefined();
  });

  it("returns cached value within TTL", () => {
    voiceDedup.set("s1", "hashA", { ...sampleEval(), etag: "\"e1\"" });
    expect(voiceDedup.get("s1", "hashA")?.guidance).toBe("Ask about the business.");
  });

  it("expires after TTL (default 5s)", () => {
    voiceDedup.set("s1", "hashA", { ...sampleEval(), etag: "\"e1\"" });
    vi.advanceTimersByTime(5_001);
    expect(voiceDedup.get("s1", "hashA")).toBeUndefined();
  });

  it("invalidate removes all keys for a session", () => {
    voiceDedup.set("s1", "hashA", { ...sampleEval(), etag: "\"e1\"" });
    voiceDedup.set("s1", "hashB", { ...sampleEval(), etag: "\"e2\"" });
    voiceDedup.set("s2", "hashA", { ...sampleEval(), etag: "\"e3\"" });
    const removed = voiceDedup.invalidate("s1");
    expect(removed).toBe(2);
    expect(voiceDedup.get("s1", "hashA")).toBeUndefined();
    expect(voiceDedup.get("s1", "hashB")).toBeUndefined();
    expect(voiceDedup.get("s2", "hashA")?.guidance).toBe("Ask about the business.");
  });

  it("updates stat counters on hit/miss/invalidate", () => {
    const before = { ...voiceDedup.stats() };
    voiceDedup.get("missing", "hash");
    voiceDedup.set("s1", "hashA", { ...sampleEval(), etag: "\"e1\"" });
    voiceDedup.get("s1", "hashA");
    voiceDedup.invalidate("s1");
    const stats = voiceDedup.stats();
    expect(stats.misses).toBeGreaterThanOrEqual(before.misses + 1);
    expect(stats.hits).toBeGreaterThanOrEqual(before.hits + 1);
    expect(stats.writes).toBeGreaterThanOrEqual(before.writes + 1);
    expect(stats.invalidations).toBeGreaterThanOrEqual(before.invalidations + 1);
  });
});

describe("voice-dedup — runOrJoin (thundering-herd guard)", () => {
  beforeEach(() => voiceDedup.clear());
  afterEach(() => voiceDedup.clear());

  it("runs compute exactly once for concurrent calls with the same key", async () => {
    let invocations = 0;
    const compute = async () => {
      invocations += 1;
      await new Promise((r) => setTimeout(r, 10));
      return { ...sampleEval(), etag: "\"shared\"" };
    };
    const [a, b, c] = await Promise.all([
      voiceDedup.runOrJoin("s1", "hashA", compute),
      voiceDedup.runOrJoin("s1", "hashA", compute),
      voiceDedup.runOrJoin("s1", "hashA", compute),
    ]);
    expect(invocations).toBe(1);
    expect(a.joined).toBe(false);
    expect(b.joined).toBe(true);
    expect(c.joined).toBe(true);
    expect(a.value?.guidance).toBe("Ask about the business.");
    expect(b.value?.guidance).toBe("Ask about the business.");
    expect(voiceDedup.stats().inFlightHits).toBeGreaterThanOrEqual(2);
  });

  it("different keys run independently", async () => {
    let invocations = 0;
    const compute = async () => {
      invocations += 1;
      return { ...sampleEval(), etag: `"e${invocations}"` };
    };
    await Promise.all([
      voiceDedup.runOrJoin("s1", "hashA", compute),
      voiceDedup.runOrJoin("s1", "hashB", compute),
      voiceDedup.runOrJoin("s2", "hashA", compute),
    ]);
    expect(invocations).toBe(3);
  });

  it("caches the successful result so subsequent sync get() hits", async () => {
    await voiceDedup.runOrJoin("s1", "hashA", async () => ({
      ...sampleEval(),
      etag: "\"cached\"",
    }));
    const cached = voiceDedup.get("s1", "hashA");
    expect(cached?.etag).toBe("\"cached\"");
  });

  it("clears in-flight slot on failure so next caller retries", async () => {
    let calls = 0;
    const compute = async () => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return { ...sampleEval(), etag: "\"retry\"" };
    };
    await expect(voiceDedup.runOrJoin("s1", "hashA", compute)).rejects.toThrow("boom");
    const second = await voiceDedup.runOrJoin("s1", "hashA", compute);
    expect(calls).toBe(2);
    expect(second.value?.etag).toBe("\"retry\"");
  });

  it("skips trailing set() when invalidate fires during compute", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const compute = async () => {
      await gate;
      return { ...sampleEval(), etag: "\"stale\"" };
    };
    const pending = voiceDedup.runOrJoin("s1", "hashA", compute);
    // Invalidate while compute is still awaiting the gate.
    voiceDedup.invalidate("s1");
    release();
    const result = await pending;
    // Compute resolved with a value, but the session gen advanced so set()
    // was skipped. Cache must remain empty for this key.
    expect(result.value?.etag).toBe("\"stale\"");
    expect(voiceDedup.get("s1", "hashA")).toBeUndefined();
  });
});
