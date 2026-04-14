/**
 * Ditto — Self Context Tests (Brief 148)
 *
 * Tests for person-scoped memory loading in loadSelfMemories.
 * Follows network-chat.test.ts mocking pattern with real test DB.
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

// Mock interaction-events (depends on external state)
vi.mock("./interaction-events", () => ({
  buildInteractionSummary: vi.fn().mockResolvedValue(null),
}));

// Mock user-model (depends on external state)
vi.mock("./user-model", () => ({
  updateWorkingPatterns: vi.fn().mockResolvedValue(undefined),
}));

describe("self-context", () => {
  beforeEach(() => {
    const result = createTestDb();
    testDb = result.db as TestDb;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("loadSelfMemories — person-scoped memories (Brief 148)", () => {
    it("returns person-scoped memories for matching email", async () => {
      const { loadSelfMemories } = await import("./self-context");

      // Create a networkUser (workspace user)
      const [networkUser] = await testDb.insert(schema.networkUsers).values({
        email: "sarah@example.com",
        name: "Sarah",
        status: "active",
      }).returning();

      // Create a person record with same email
      const [person] = await testDb.insert(schema.people).values({
        name: "Sarah",
        email: "sarah@example.com",
        userId: networkUser.id,
        source: "manual",
        visibility: "internal",
      }).returning();

      // Create person-scoped memories (from frontdoor)
      await testDb.insert(schema.memories).values([
        {
          scopeType: "person",
          scopeId: person.id,
          type: "user_model",
          content: "Business: Sarah's Plumbing",
          source: "conversation",
          active: true,
        },
        {
          scopeType: "person",
          scopeId: person.id,
          type: "user_model",
          content: "Location: Melbourne",
          source: "conversation",
          active: true,
        },
      ]);

      const result = await loadSelfMemories(networkUser.id, 1000);

      expect(result).toContain("From your earlier conversation:");
      expect(result).toContain("Business: Sarah's Plumbing");
      expect(result).toContain("Location: Melbourne");
    });

    it("returns empty person memories when no person record exists", async () => {
      const { loadSelfMemories } = await import("./self-context");

      // Create a networkUser with no matching person
      const [networkUser] = await testDb.insert(schema.networkUsers).values({
        email: "unknown@example.com",
        name: "Unknown",
        status: "active",
      }).returning();

      const result = await loadSelfMemories(networkUser.id, 1000);

      // Should not crash, should not contain frontdoor header
      expect(result).not.toContain("From your earlier conversation:");
    });

    it("returns empty when no networkUser found for userId", async () => {
      const { loadSelfMemories } = await import("./self-context");

      // Non-existent userId — should not crash
      const result = await loadSelfMemories("nonexistent-user-id", 1000);
      expect(result).toBe("");
    });

    it("includes both self-scoped and person-scoped memories", async () => {
      const { loadSelfMemories } = await import("./self-context");

      const [networkUser] = await testDb.insert(schema.networkUsers).values({
        email: "combo@example.com",
        name: "Combo",
        status: "active",
      }).returning();

      const [person] = await testDb.insert(schema.people).values({
        name: "Combo",
        email: "combo@example.com",
        userId: networkUser.id,
        source: "manual",
        visibility: "internal",
      }).returning();

      // Self-scoped memory
      await testDb.insert(schema.memories).values({
        scopeType: "self",
        scopeId: networkUser.id,
        type: "preference",
        content: "Prefers concise responses",
        source: "feedback",
        active: true,
      });

      // Person-scoped memory
      await testDb.insert(schema.memories).values({
        scopeType: "person",
        scopeId: person.id,
        type: "user_model",
        content: "Role: CEO",
        source: "conversation",
        active: true,
      });

      const result = await loadSelfMemories(networkUser.id, 1000);

      expect(result).toContain("Prefers concise responses");
      expect(result).toContain("From your earlier conversation:");
      expect(result).toContain("Role: CEO");
    });

    it("does not leak user A's frontdoor context to user B", async () => {
      const { loadSelfMemories } = await import("./self-context");

      // User A
      const [userA] = await testDb.insert(schema.networkUsers).values({
        email: "userA@example.com",
        name: "User A",
        status: "active",
      }).returning();

      const [personA] = await testDb.insert(schema.people).values({
        name: "User A",
        email: "userA@example.com",
        userId: userA.id,
        source: "manual",
        visibility: "internal",
      }).returning();

      await testDb.insert(schema.memories).values({
        scopeType: "person",
        scopeId: personA.id,
        type: "user_model",
        content: "Business: A Corp",
        source: "conversation",
        active: true,
      });

      // User B
      const [userB] = await testDb.insert(schema.networkUsers).values({
        email: "userB@example.com",
        name: "User B",
        status: "active",
      }).returning();

      // User B should NOT see User A's memories
      const result = await loadSelfMemories(userB.id, 1000);
      expect(result).not.toContain("A Corp");
    });
  });
});
