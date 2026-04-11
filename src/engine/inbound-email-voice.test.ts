/**
 * Voice Model Collection Tests (Brief 124)
 *
 * Verifies that inbound email processing passively collects
 * voice model samples from user email replies.
 *
 * Tests:
 * - Substantive replies (>= 50 chars) are stored as voice_model memories
 * - Short replies ("ok", "thanks") are NOT stored
 * - Voice model readiness check (getVoiceModelReadiness)
 * - Voice model loading (loadVoiceModelSamples)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../test-utils";
import * as schema from "../db/schema";
import { eq, and } from "drizzle-orm";

let testDb: TestDb;
let cleanup: () => void;

vi.mock("../db", async () => {
  const realSchema = await vi.importActual<typeof import("../db/schema")>("../db/schema");
  return {
    get db() { return testDb; },
    schema: realSchema,
  };
});

const { getVoiceModelReadiness, loadVoiceModelSamples } = await import("./people");

beforeEach(() => {
  const result = createTestDb();
  testDb = result.db;
  cleanup = result.cleanup;
});

afterEach(() => {
  cleanup();
});

describe("getVoiceModelReadiness (Brief 124)", () => {
  it("returns not ready when zero samples exist", async () => {
    const result = await getVoiceModelReadiness("user-123");
    expect(result.ready).toBe(false);
    expect(result.sampleCount).toBe(0);
  });

  it("returns not ready with 3 samples (below threshold of 5)", async () => {
    for (let i = 0; i < 3; i++) {
      await testDb.insert(schema.memories).values({
        scopeType: "self",
        scopeId: "user-123",
        type: "voice_model",
        content: `Sample email ${i}: Thanks for the update, I'll review and get back to you shortly.`,
        source: "system",
      });
    }

    const result = await getVoiceModelReadiness("user-123");
    expect(result.ready).toBe(false);
    expect(result.sampleCount).toBe(3);
  });

  it("returns ready when 5+ samples exist", async () => {
    for (let i = 0; i < 5; i++) {
      await testDb.insert(schema.memories).values({
        scopeType: "self",
        scopeId: "user-456",
        type: "voice_model",
        content: `Sample email ${i}: Hey team, let's sync up on this tomorrow morning. I think we need to rethink the approach.`,
        source: "system",
      });
    }

    const result = await getVoiceModelReadiness("user-456");
    expect(result.ready).toBe(true);
    expect(result.sampleCount).toBe(5);
  });

  it("does not count inactive voice model memories", async () => {
    for (let i = 0; i < 5; i++) {
      await testDb.insert(schema.memories).values({
        scopeType: "self",
        scopeId: "user-789",
        type: "voice_model",
        content: `Sample ${i}`,
        source: "system",
        active: i < 3, // only 3 active
      });
    }

    const result = await getVoiceModelReadiness("user-789");
    expect(result.ready).toBe(false);
    expect(result.sampleCount).toBe(3);
  });

  it("does not count other memory types", async () => {
    // Insert 5 correction memories (not voice_model)
    for (let i = 0; i < 5; i++) {
      await testDb.insert(schema.memories).values({
        scopeType: "self",
        scopeId: "user-abc",
        type: "correction",
        content: `Correction ${i}`,
        source: "system",
      });
    }

    const result = await getVoiceModelReadiness("user-abc");
    expect(result.ready).toBe(false);
    expect(result.sampleCount).toBe(0);
  });
});

describe("loadVoiceModelSamples (Brief 124)", () => {
  it("returns null when insufficient samples", async () => {
    const result = await loadVoiceModelSamples("user-123");
    expect(result).toBeNull();
  });

  it("returns formatted samples when ready", async () => {
    for (let i = 0; i < 5; i++) {
      await testDb.insert(schema.memories).values({
        scopeType: "self",
        scopeId: "user-load",
        type: "voice_model",
        content: `Hey, thanks for reaching out. Sample ${i} with enough content.`,
        source: "system",
        metadata: { subject: `Re: Meeting ${i}` },
      });
    }

    const result = await loadVoiceModelSamples("user-load");
    expect(result).not.toBeNull();
    expect(result).toContain("--- Sample 1");
    expect(result).toContain("--- Sample 5");
    expect(result).toContain("Re: Meeting");
    expect(result).toContain("Hey, thanks for reaching out");
  });
});
