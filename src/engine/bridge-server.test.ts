/**
 * Bridge server unit tests — orphan sweep + queue drain (Brief 212 ACs #8, #10).
 *
 * Spike test (`bridge-server.spike.test.ts`) covers AC #1 with a real Next.js
 * boot. This file covers the in-process behavior with an injectable test DB.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../test-utils";

let testDb: TestDb;
let cleanup: () => void;

vi.mock("../db", async () => {
  const actualSchema = await vi.importActual<typeof import("../db/schema")>("../db/schema");
  return {
    get db() {
      return testDb;
    },
    schema: actualSchema,
  };
});

async function seedFixtures(db: TestDb) {
  const { processes, processRuns, stepRuns, bridgeDevices } = await import("../db/schema");
  // Process must exist for FK.
  const procInsert = await db
    .insert(processes)
    .values({
      name: "Test process",
      slug: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      version: 1,
      trustTier: "supervised",
      definition: {},
    })
    .returning();
  const processId = procInsert[0].id;

  const runInsert = await db
    .insert(processRuns)
    .values({ processId, triggeredBy: "test" })
    .returning();
  const processRunId = runInsert[0].id;

  const stepInsert = await db
    .insert(stepRuns)
    .values({
      processRunId,
      stepId: "test-step",
      executorType: "ai-agent",
    })
    .returning();
  const stepRunId = stepInsert[0].id;

  const deviceInsert = await db
    .insert(bridgeDevices)
    .values({
      workspaceId: "default",
      deviceName: "Test Device",
      jwtTokenHash: "test-hash",
      protocolVersion: "1.0.0",
      pairedAt: new Date(),
      lastDialAt: new Date(),
      status: "active",
    })
    .returning();
  const deviceId = deviceInsert[0].id;

  return { processRunId, stepRunId, deviceId };
}

describe("bridge sweepStaleJobs (AC #10)", () => {
  beforeEach(() => {
    const result = createTestDb();
    testDb = result.db;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("transitions running → orphaned when lastHeartbeatAt > 10 min", async () => {
    const { sweepStaleJobs } = await import("./bridge-server");
    const { bridgeJobs, harnessDecisions } = await import("../db/schema");
    const fx = await seedFixtures(testDb);

    const now = new Date("2026-04-25T12:00:00Z");
    const stale = new Date(now.getTime() - 11 * 60 * 1000); // 11 min ago

    await testDb.insert(bridgeJobs).values({
      deviceId: fx.deviceId,
      processRunId: fx.processRunId,
      stepRunId: fx.stepRunId,
      kind: "exec",
      payload: { kind: "exec", command: "sleep", args: ["100"] },
      state: "running",
      queuedAt: stale,
      dispatchedAt: stale,
      lastHeartbeatAt: stale,
    });

    const swept = await sweepStaleJobs(now);
    expect(swept).toBe(1);

    const rows = await testDb.select().from(bridgeJobs);
    expect(rows[0].state).toBe("orphaned");
    expect(rows[0].completedAt).toBeTruthy();

    const auditRows = await testDb.select().from(harnessDecisions);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].trustAction).toBe("pause");
    expect(auditRows[0].reviewPattern).toContain("bridge_orphaned");
    const reviewDetails = auditRows[0].reviewDetails as { bridge: { orphaned: boolean; deviceName: string } };
    expect(reviewDetails.bridge.orphaned).toBe(true);
    expect(reviewDetails.bridge.deviceName).toBe("Test Device");
  });

  it("does NOT transition jobs whose heartbeat is recent", async () => {
    const { sweepStaleJobs } = await import("./bridge-server");
    const { bridgeJobs } = await import("../db/schema");
    const fx = await seedFixtures(testDb);

    const now = new Date("2026-04-25T12:00:00Z");
    const recent = new Date(now.getTime() - 30 * 1000); // 30s ago

    await testDb.insert(bridgeJobs).values({
      deviceId: fx.deviceId,
      processRunId: fx.processRunId,
      stepRunId: fx.stepRunId,
      kind: "exec",
      payload: { kind: "exec", command: "echo", args: ["hi"] },
      state: "running",
      queuedAt: recent,
      dispatchedAt: recent,
      lastHeartbeatAt: recent,
    });

    const swept = await sweepStaleJobs(now);
    expect(swept).toBe(0);

    const rows = await testDb.select().from(bridgeJobs);
    expect(rows[0].state).toBe("running");
  });

  it("does NOT touch terminal-state jobs", async () => {
    const { sweepStaleJobs } = await import("./bridge-server");
    const { bridgeJobs } = await import("../db/schema");
    const fx = await seedFixtures(testDb);

    const now = new Date("2026-04-25T12:00:00Z");
    const stale = new Date(now.getTime() - 11 * 60 * 1000);

    await testDb.insert(bridgeJobs).values({
      deviceId: fx.deviceId,
      processRunId: fx.processRunId,
      stepRunId: fx.stepRunId,
      kind: "exec",
      payload: { kind: "exec", command: "echo", args: ["hi"] },
      state: "succeeded",
      queuedAt: stale,
      dispatchedAt: stale,
      completedAt: stale,
      lastHeartbeatAt: stale,
    });

    const swept = await sweepStaleJobs(now);
    expect(swept).toBe(0);
  });
});

describe("bridge drainQueueForDevice (AC #8a)", () => {
  beforeEach(() => {
    const result = createTestDb();
    testDb = result.db;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("does not transition queued jobs when the device isn't connected", async () => {
    const { drainQueueForDevice } = await import("./bridge-server");
    const { bridgeJobs } = await import("../db/schema");
    const fx = await seedFixtures(testDb);

    await testDb.insert(bridgeJobs).values([
      {
        deviceId: fx.deviceId,
        processRunId: fx.processRunId,
        stepRunId: fx.stepRunId,
        kind: "exec",
        payload: { kind: "exec", command: "echo", args: ["1"] },
        state: "queued",
        queuedAt: new Date(Date.now() - 2000),
      },
      {
        deviceId: fx.deviceId,
        processRunId: fx.processRunId,
        stepRunId: fx.stepRunId,
        kind: "exec",
        payload: { kind: "exec", command: "echo", args: ["2"] },
        state: "queued",
        queuedAt: new Date(Date.now() - 1000),
      },
    ]);

    // No connection registered → sendBridgeFrame returns false → drain stops
    // before transitioning anything.
    const drained = await drainQueueForDevice(fx.deviceId);
    expect(drained).toBe(0);

    const rows = await testDb.select().from(bridgeJobs);
    expect(rows.every((r) => r.state === "queued")).toBe(true);
  });
});
