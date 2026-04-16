/**
 * Process I/O Tests (Brief 036)
 *
 * Tests: polling creates work items with triggeredBy, output delivery calls integration handler,
 * output delivery only after approval, graceful stop, missing output_delivery is no-op,
 * process-loader validates source/output_delivery service references.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../test-utils";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import type { ProcessDefinition } from "./process-loader";

let testDb: TestDb;
let cleanup: () => void;

// Mock the db module
vi.mock("../db", async () => {
  const actualSchema = await vi.importActual<typeof import("../db/schema")>("../db/schema");
  return {
    get db() {
      return testDb;
    },
    schema: actualSchema,
  };
});

// Mock integration registry and handlers
vi.mock("./integration-registry", () => ({
  getIntegration: vi.fn((service: string) => {
    if (service === "email" || service === "accounting" || service === "test-service") {
      return {
        service,
        description: `${service} integration`,
        interfaces: { cli: { command: service } },
        preferred: "cli",
      };
    }
    return undefined;
  }),
  getIntegrationRegistry: vi.fn(),
  clearRegistryCache: vi.fn(),
}));

vi.mock("./integration-handlers", () => ({
  executeIntegration: vi.fn(async (config: { service: string; command: string }) => ({
    outputs: { result: `mock-result-from-${config.service}` },
    confidence: "high" as const,
    logs: [`Executed ${config.command} on ${config.service}`],
  })),
}));

// Mock heartbeat to avoid running actual pipeline
vi.mock("./heartbeat", () => ({
  startProcessRun: vi.fn(async (slug: string, inputs: Record<string, unknown>, triggeredBy: string) => {
    // Create a process run record in the test DB
    const procs = testDb.select().from(schema.processes).where(eq(schema.processes.slug, slug)).all();
    if (procs.length === 0) throw new Error(`Process not found: ${slug}`);

    const [run] = testDb.insert(schema.processRuns).values({
      processId: procs[0].id,
      status: "queued",
      triggeredBy,
      inputs,
    }).returning().all();

    return run.id;
  }),
  fullHeartbeat: vi.fn(async () => ({
    processRunId: "mock-run",
    stepsExecuted: 1,
    status: "completed",
    message: "Mock heartbeat complete",
  })),
  runHeartbeatDetached: vi.fn(),
}));

const { deliverOutput, startPolling, stopPolling, getPollingStatus, stopAllPolling } =
  await import("./process-io");
const { executeIntegration } = await import("./integration-handlers");

async function createProcess(
  db: TestDb,
  id: string,
  slug: string,
  definition?: Partial<ProcessDefinition>,
): Promise<void> {
  const baseDef: Record<string, unknown> = {
    name: slug,
    id: slug,
    version: 1,
    status: "active",
    description: "test",
    trigger: { type: "manual" },
    inputs: [],
    steps: [{ id: "step-1", name: "Test", executor: "script", commands: ["echo test"] }],
    outputs: [],
    quality_criteria: [],
    feedback: { metrics: [], capture: [] },
    trust: { initial_tier: "supervised", upgrade_path: [], downgrade_triggers: [] },
    ...definition,
  };

  await db.insert(schema.processes).values({
    id,
    name: slug,
    slug,
    definition: baseDef,
    source: (definition?.source ?? null) as typeof schema.processes.source._.data,
    outputDelivery: (definition?.output_delivery ?? null) as typeof schema.processes.outputDelivery._.data,
  });
}

beforeEach(async () => {
  const result = createTestDb();
  testDb = result.db;
  cleanup = result.cleanup;
  vi.clearAllMocks();
  // Clean up any active pollers from previous tests
  stopAllPolling();
});

afterEach(() => {
  stopAllPolling();
  cleanup();
});

describe("process-io", () => {
  describe("polling", () => {
    it("creates work items with triggeredBy 'trigger' when source returns results", async () => {
      await createProcess(testDb, "proc-1", "trigger-test", {
        source: {
          service: "test-service",
          action: "check_source",
          params: { filter: "test" },
          intervalMs: 60000,
        },
      });

      // Start polling (runs first poll immediately)
      await startPolling("trigger-test");

      // Stop immediately to prevent interval from firing
      stopPolling("trigger-test");

      // Check that a work item was created
      const workItems = testDb.select().from(schema.workItems).all();
      expect(workItems.length).toBe(1);
      expect(workItems[0].source).toBe("system_generated");

      const ctx = workItems[0].context as Record<string, unknown>;
      expect(ctx.triggeredBy).toBe("trigger");
      expect(ctx.sourceService).toBe("test-service");

      // Check that a process run was created with triggeredBy: "trigger"
      const runs = testDb.select().from(schema.processRuns).all();
      expect(runs.length).toBe(1);
      expect(runs[0].triggeredBy).toBe("trigger");
    });

    it("stopPolling gracefully stops the polling loop", async () => {
      await createProcess(testDb, "proc-2", "stop-test", {
        source: {
          service: "test-service",
          action: "check_source",
          params: {},
          intervalMs: 1000,
        },
      });

      await startPolling("stop-test");
      expect(getPollingStatus().length).toBe(1);

      stopPolling("stop-test");
      expect(getPollingStatus().length).toBe(0);
    });

    it("getPollingStatus returns active polling loops", async () => {
      await createProcess(testDb, "proc-3", "status-test", {
        source: {
          service: "test-service",
          action: "check_inbox",
          params: { filter: "test" },
          intervalMs: 30000,
        },
      });

      await startPolling("status-test");
      const status = getPollingStatus();

      expect(status.length).toBe(1);
      expect(status[0].processSlug).toBe("status-test");
      expect(status[0].intervalMs).toBe(30000);
      expect(status[0].service).toBe("test-service");
      expect(status[0].action).toBe("check_inbox");
      expect(status[0].lastCheck).toBeInstanceOf(Date);

      stopPolling("status-test");
    });

    it("throws if process has no source configuration", async () => {
      await createProcess(testDb, "proc-4", "no-source-test");

      await expect(startPolling("no-source-test")).rejects.toThrow(
        'Process "no-source-test" has no source configuration',
      );
    });
  });

  describe("output delivery", () => {
    it("calls integration handler when output_delivery is configured", async () => {
      await createProcess(testDb, "proc-5", "delivery-test", {
        output_delivery: {
          service: "accounting",
          action: "post_invoice",
          params: { format: "json" },
        },
      });

      // Create a completed process run with an approved step
      const [run] = testDb
        .insert(schema.processRuns)
        .values({
          processId: "proc-5",
          status: "approved",
          triggeredBy: "manual",
          completedAt: new Date(),
        })
        .returning()
        .all();

      testDb
        .insert(schema.stepRuns)
        .values({
          processRunId: run.id,
          stepId: "step-1",
          status: "approved",
          executorType: "script",
          outputs: { sendReport: { total: 5, sent: 3 } },
          completedAt: new Date(),
        })
        .run();

      await deliverOutput(run.id);

      // Check that executeIntegration was called with outputs in the command payload
      expect(executeIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          service: "accounting",
          processId: "proc-5",
        }),
        expect.objectContaining({ service: "accounting" }),
      );

      // Verify the command contains the action and the outputs payload
      const callArgs = (executeIntegration as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.command).toContain("post_invoice");
      expect(callArgs.command).toContain("sendReport");

      // Check activity was logged
      const activities = testDb.select().from(schema.activities).all();
      const deliveryActivity = activities.find((a) => a.action === "output.delivered");
      expect(deliveryActivity).toBeDefined();
      expect((deliveryActivity!.metadata as Record<string, unknown>).service).toBe("accounting");
    });

    it("gathers outputs from approved steps only", async () => {
      await createProcess(testDb, "proc-7", "approved-only-test", {
        output_delivery: {
          service: "accounting",
          action: "post_results",
          params: {},
        },
      });

      const [run] = testDb
        .insert(schema.processRuns)
        .values({
          processId: "proc-7",
          status: "approved",
          triggeredBy: "manual",
          completedAt: new Date(),
        })
        .returning()
        .all();

      // One approved step, one failed step
      testDb
        .insert(schema.stepRuns)
        .values({
          processRunId: run.id,
          stepId: "approved-step",
          status: "approved",
          executorType: "script",
          outputs: { result: "good" },
          completedAt: new Date(),
        })
        .run();

      testDb
        .insert(schema.stepRuns)
        .values({
          processRunId: run.id,
          stepId: "failed-step",
          status: "failed",
          executorType: "script",
          outputs: { result: "bad" },
          error: "something failed",
        })
        .run();

      await deliverOutput(run.id);

      // The command payload should contain only the approved step's output
      const callArgs = (executeIntegration as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const payloadStr = callArgs.command.split(" ").slice(1).join(" ");
      const payload = JSON.parse(payloadStr);
      expect(payload.outputs["approved-step"]).toBeDefined();
      expect(payload.outputs["failed-step"]).toBeUndefined();
    });

    it("is a no-op when process has no output_delivery", async () => {
      await createProcess(testDb, "proc-6", "no-delivery-test");

      const [run] = testDb
        .insert(schema.processRuns)
        .values({
          processId: "proc-6",
          status: "approved",
          triggeredBy: "manual",
        })
        .returning()
        .all();

      // Should not throw
      await deliverOutput(run.id);

      // Should not have called executeIntegration
      expect(executeIntegration).not.toHaveBeenCalled();
    });
  });

  describe("process-loader validation", () => {
    it("validates source service against integration registry", async () => {
      const { validateProcessIo } = await import("./process-loader");

      const def = {
        source: { service: "nonexistent-service", action: "check", params: {}, intervalMs: 1000 },
      } as unknown as ProcessDefinition;

      const errors = validateProcessIo(def);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain("nonexistent-service");
      expect(errors[0]).toContain("not found in integration registry");
    });

    it("validates output_delivery service against integration registry", async () => {
      const { validateProcessIo } = await import("./process-loader");

      const def = {
        output_delivery: { service: "nonexistent-service", action: "post", params: {} },
      } as unknown as ProcessDefinition;

      const errors = validateProcessIo(def);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain("nonexistent-service");
    });

    it("passes when source/output_delivery services exist", async () => {
      const { validateProcessIo } = await import("./process-loader");

      const def = {
        source: { service: "email", action: "check", params: {}, intervalMs: 1000 },
        output_delivery: { service: "accounting", action: "post", params: {} },
      } as unknown as ProcessDefinition;

      const errors = validateProcessIo(def);
      expect(errors.length).toBe(0);
    });
  });
});
