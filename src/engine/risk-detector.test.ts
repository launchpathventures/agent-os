/**
 * Ditto — Risk Detector Tests (MP-7.3 stale_review)
 *
 * Covers the stale_review branch added for MP-7.3: process runs sitting in
 * waiting_review / waiting_human past the threshold should surface as risks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../test-utils";
import * as schema from "../db/schema";

let testDb: TestDb;
let cleanup: () => void;

vi.mock("../db", async () => {
  const realSchema = await vi.importActual<typeof import("../db/schema")>("../db/schema");
  return {
    get db() {
      return testDb;
    },
    schema: realSchema,
  };
});

// Keep correction-pattern detection quiet — no trust state for seeded processes.
vi.mock("./trust", () => ({
  computeTrustState: vi.fn().mockResolvedValue({
    runsInWindow: 0,
    correctionRate: 0,
    trend: "stable",
  }),
}));

// Silence active-polling enumeration.
vi.mock("./process-io", () => ({
  getPollingStatus: vi.fn().mockReturnValue([]),
}));

describe("risk-detector — stale_review (MP-7.3)", () => {
  beforeEach(() => {
    const result = createTestDb();
    testDb = result.db;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  async function seedRun(
    status: "waiting_review" | "waiting_human" | "running",
    hoursAgo: number,
  ) {
    const [proc] = await testDb
      .insert(schema.processes)
      .values({
        slug: `stale-proc-${Math.random().toString(36).slice(2, 10)}`,
        name: `Stale Proc ${hoursAgo}h`,
        definition: {},
      })
      .returning();

    const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const [run] = await testDb
      .insert(schema.processRuns)
      .values({
        processId: proc.id,
        status,
        triggeredBy: "test",
        startedAt: createdAt,
        createdAt,
      })
      .returning();

    return { run, proc };
  }

  it("flags a waiting_review run older than the threshold", async () => {
    const { detectAllRisks } = await import("./risk-detector");
    const { run, proc } = await seedRun("waiting_review", 30);

    const risks = await detectAllRisks();
    const stale = risks.find((r) => r.type === "stale_review");
    expect(stale).toBeDefined();
    expect(stale!.entityId).toBe(run.id);
    expect(stale!.entityLabel).toBe(proc.name);
    expect(stale!.detail).toContain("waiting on review");
    expect(stale!.detail).toMatch(/\d+h/);
  });

  it("flags a waiting_human run older than the threshold", async () => {
    const { detectAllRisks } = await import("./risk-detector");
    await seedRun("waiting_human", 30);

    const risks = await detectAllRisks();
    const stale = risks.find((r) => r.type === "stale_review");
    expect(stale).toBeDefined();
    expect(stale!.detail).toContain("waiting on human step");
  });

  it("escalates severity past 3x the threshold", async () => {
    const { detectAllRisks } = await import("./risk-detector");
    await seedRun("waiting_review", 80); // > 24h * 3

    const risks = await detectAllRisks();
    const stale = risks.find((r) => r.type === "stale_review");
    expect(stale?.severity).toBe("high");
  });

  it("does not flag runs inside the threshold window", async () => {
    const { detectAllRisks } = await import("./risk-detector");
    await seedRun("waiting_review", 2);

    const risks = await detectAllRisks();
    expect(risks.find((r) => r.type === "stale_review")).toBeUndefined();
  });

  it("ignores in-flight (running) runs regardless of age", async () => {
    const { detectAllRisks } = await import("./risk-detector");
    await seedRun("running", 96);

    const risks = await detectAllRisks();
    expect(risks.find((r) => r.type === "stale_review")).toBeUndefined();
  });

  it("respects a custom staleReviewHours threshold", async () => {
    const { detectAllRisks } = await import("./risk-detector");
    await seedRun("waiting_review", 3);

    const tight = await detectAllRisks({ staleReviewHours: 1 });
    expect(tight.find((r) => r.type === "stale_review")).toBeDefined();

    const loose = await detectAllRisks({ staleReviewHours: 12 });
    expect(loose.find((r) => r.type === "stale_review")).toBeUndefined();
  });
});
