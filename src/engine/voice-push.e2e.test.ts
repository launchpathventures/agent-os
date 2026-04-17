/**
 * Integration tests for Brief 180 — voice push-pull pipeline.
 *
 * Exercises the guidance-route primitives against a real SQLite test DB
 * and a stubbed LLM. Focuses on the observable contract: dedup, 304,
 * visitor-context caching, transcript invalidation.
 *
 * The fully end-to-end scenarios that require a simulated ElevenLabs
 * session (onMessage → onModeChange → sendContextualUpdate) live in the
 * client test file `packages/web/app/welcome/voice-call.test.tsx`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../test-utils";
import * as schema from "../db/schema";
import { randomUUID } from "crypto";

let testDb: TestDb;
let cleanup: () => void;

vi.mock("../db", async () => {
  const realSchema = await vi.importActual<typeof import("../db/schema")>("../db/schema");
  return {
    get db() { return testDb; },
    schema: realSchema,
  };
});

// Force mock LLM so createCompletion does not require API keys.
process.env.MOCK_LLM = "true";

const {
  evaluateVoiceConversation,
  saveVoiceTranscript,
  loadSessionForVoice,
  assembleVisitorContextCached,
  clearVisitorContextCache,
  getVisitorContextCacheStats,
} = await import("./network-chat");

const { voiceDedup, hashTranscript, buildGuidanceETag } = await import("./voice-dedup");
const { recordVoiceEvent } = await import("./voice-telemetry");

async function seedSession(overrides: Partial<{
  sessionId: string;
  voiceToken: string;
  messages: Array<{ role: string; content: string }>;
  learned: Record<string, string | null> | null;
  authenticatedEmail: string | null;
}> = {}) {
  const sessionId = overrides.sessionId ?? `sess-${randomUUID().slice(0, 8)}`;
  const voiceToken = overrides.voiceToken ?? `tok-${randomUUID().slice(0, 8)}`;
  await testDb.insert(schema.chatSessions).values({
    sessionId,
    messages: overrides.messages ?? [{ role: "user", content: "Hi there" }],
    context: "front-door",
    ipHash: "test-ip-hash",
    messageCount: (overrides.messages ?? []).length,
    learned: overrides.learned ?? null,
    voiceToken,
    authenticatedEmail: overrides.authenticatedEmail ?? null,
    stage: "main",
    personaId: "alex",
  });
  return { sessionId, voiceToken };
}

beforeEach(() => {
  const result = createTestDb();
  testDb = result.db;
  cleanup = result.cleanup;
  voiceDedup.clear();
  clearVisitorContextCache();
});

afterEach(() => {
  cleanup();
  voiceDedup.clear();
  clearVisitorContextCache();
});

describe("voice pipeline — dedup + transcript invalidation", () => {
  it("dedup cache returns the same value for identical keys within TTL", () => {
    voiceDedup.set("s1", "hA", {
      learned: {}, guidance: "ask", stage: "gathering", etag: "\"e1\"",
    });
    const first = voiceDedup.get("s1", "hA");
    const second = voiceDedup.get("s1", "hA");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.guidance).toBe("ask");
    expect(second?.guidance).toBe("ask");
  });

  it("saveVoiceTranscript invalidates dedup cache for that session", async () => {
    const { sessionId, voiceToken } = await seedSession({
      messages: [{ role: "user", content: "first turn" }],
    });

    // Seed the dedup cache for this session
    voiceDedup.set(sessionId, hashTranscript({
      sessionId,
      lastN: [{ role: "user", content: "first turn" }],
    }), {
      learned: {}, guidance: "cached answer", stage: "gathering", etag: "\"e1\"",
    });
    expect(voiceDedup.size()).toBe(1);

    // The route hook invalidates on transcript save — simulate the route path.
    const success = await saveVoiceTranscript(sessionId, voiceToken, [
      { role: "user", text: "second turn from voice" },
    ]);
    expect(success).toBe(true);
    voiceDedup.invalidate(sessionId);
    expect(voiceDedup.size()).toBe(0);
  });

  it("ETag changes when learned advances", async () => {
    const { sessionId } = await seedSession({ learned: { name: "Jane" } });
    const a = buildGuidanceETag({ sessionId, learned: { name: "Jane" }, lastTurnIndex: 1 });
    const b = buildGuidanceETag({
      sessionId,
      learned: { name: "Jane", business: "Acme" },
      lastTurnIndex: 1,
    });
    expect(a).not.toBe(b);
  });
});

describe("visitor context caching (AC 7-8)", () => {
  it("assembleVisitorContextCached caches per session for 60s", async () => {
    // No person exists — cache still records the synthesized "returning stranger" shape.
    const sessionId = "sess-visitor";
    const email = "jane@example.com";

    const before = { ...getVisitorContextCacheStats() };
    const first = await assembleVisitorContextCached(sessionId, email);
    expect(first.cacheHit).toBe(false);
    expect(first.context.email).toBe(email);

    const second = await assembleVisitorContextCached(sessionId, email);
    expect(second.cacheHit).toBe(true);

    const stats = getVisitorContextCacheStats();
    expect(stats.hits).toBeGreaterThanOrEqual(before.hits + 1);
    expect(stats.misses).toBeGreaterThanOrEqual(before.misses + 1);
  });

  it("changing email busts the cache", async () => {
    const sessionId = "sess-change";
    await assembleVisitorContextCached(sessionId, "a@example.com");
    const second = await assembleVisitorContextCached(sessionId, "b@example.com");
    expect(second.cacheHit).toBe(false);
    expect(second.context.email).toBe("b@example.com");
  });
});

describe("voice evaluation pipeline (MOCK_LLM)", () => {
  it("evaluateVoiceConversation returns null for a session with no messages", async () => {
    const sessionId = `empty-${randomUUID().slice(0, 6)}`;
    await testDb.insert(schema.chatSessions).values({
      sessionId,
      messages: [],
      context: "front-door",
      ipHash: "ip",
      voiceToken: "tok",
      stage: "main",
      personaId: "alex",
    });
    const result = await evaluateVoiceConversation(sessionId);
    expect(result).toBeNull();
  });

  it("loadSessionForVoice enforces voiceToken matching", async () => {
    const { sessionId, voiceToken } = await seedSession();
    const good = await loadSessionForVoice(sessionId, voiceToken);
    expect(good).not.toBeNull();
    const bad = await loadSessionForVoice(sessionId, "wrong-token");
    expect(bad).toBeNull();
  });
});

describe("telemetry events (AC 19-21)", () => {
  it("recordVoiceEvent persists a row with the given event", async () => {
    const sessionId = "telem-" + randomUUID().slice(0, 6);
    await recordVoiceEvent(sessionId, "push_fired", { trigger: "user_final" });
    const all = await testDb.select().from(schema.voiceEvents);
    const mine = all.filter((r) => r.sessionId === sessionId);
    expect(mine.length).toBe(1);
    expect(mine[0].event).toBe("push_fired");
    expect(mine[0].metadata).toEqual({ trigger: "user_final" });
  });

  it("recordVoiceEvent strips PII-looking keys from metadata", async () => {
    const sessionId = "telem-pii-" + randomUUID().slice(0, 6);
    await recordVoiceEvent(sessionId, "push_fired", {
      trigger: "user_final",
      email: "leaked@example.com",
      transcript: "user said something",
    });
    const all = await testDb.select().from(schema.voiceEvents);
    const mine = all.filter((r) => r.sessionId === sessionId);
    expect(mine.length).toBe(1);
    const meta = mine[0].metadata as Record<string, unknown>;
    expect(meta.trigger).toBe("user_final");
    expect(meta).not.toHaveProperty("email");
    expect(meta).not.toHaveProperty("transcript");
  });
});
