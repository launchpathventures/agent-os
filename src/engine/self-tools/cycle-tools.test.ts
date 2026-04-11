/**
 * Tests for Brief 118 — Operating Cycle Self-Tools
 *
 * Tests: activate_cycle, pause_cycle, resume_cycle, cycle_briefing, cycle_status
 * Also tests cycle-aware network tools and scheduler dual triggers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../../test-utils";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

let testDb: TestDb;
let cleanup: () => void;

vi.mock("../../db", async () => {
  const realSchema = await vi.importActual<typeof import("../../db/schema")>("../../db/schema");
  return {
    get db() { return testDb; },
    schema: realSchema,
  };
});

// Mock heartbeat to avoid actual process execution
vi.mock("../heartbeat", () => ({
  startProcessRun: vi.fn(async (slug: string, inputs: Record<string, unknown>, triggeredBy: string) => {
    // Look up the real process ID from the test DB
    const [proc] = testDb
      .select({ id: schema.processes.id })
      .from(schema.processes)
      .where(eq(schema.processes.slug, slug))
      .all();

    const processId = proc?.id ?? `proc-${slug}`;

    const runId = randomUUID();
    testDb.insert(schema.processRuns).values({
      id: runId,
      processId,
      status: "queued",
      triggeredBy,
      inputs: inputs as Record<string, unknown>,
    }).run();

    return runId;
  }),
  fullHeartbeat: vi.fn(async () => ({
    processRunId: "mock",
    stepsExecuted: 0,
    status: "completed",
    message: "mock",
  })),
}));

// Import after mocks
const {
  handleActivateCycle,
  handlePauseCycle,
  handleResumeCycle,
  handleCycleBriefing,
  handleCycleStatus,
} = await import("./cycle-tools");

const SALES_DEFINITION = {
  name: "Sales & Marketing Cycle",
  id: "sales-marketing-cycle",
  version: 1,
  status: "active",
  trigger: { type: "schedule", cron: "0 8 * * 1-5" },
  inputs: [],
  steps: [],
  outputs: [],
  quality_criteria: [],
  feedback: { metrics: [], capture: [] },
  trust: { initial_tier: "supervised", upgrade_path: [], downgrade_triggers: [] },
};

const CONNECT_DEFINITION = {
  name: "Network Connecting Cycle",
  id: "network-connecting-cycle",
  version: 1,
  status: "active",
  trigger: { type: "schedule", cron: "0 9 * * 1,4" },
  inputs: [],
  steps: [],
  outputs: [],
  quality_criteria: [],
  feedback: { metrics: [], capture: [] },
  trust: { initial_tier: "supervised", upgrade_path: [], downgrade_triggers: [] },
};

beforeEach(() => {
  const result = createTestDb();
  testDb = result.db;
  cleanup = result.cleanup;

  // Seed processes
  testDb.insert(schema.processes).values({
    name: "Sales & Marketing Cycle",
    slug: "sales-marketing-cycle",
    definition: SALES_DEFINITION as unknown as Record<string, unknown>,
  }).run();

  testDb.insert(schema.processes).values({
    name: "Network Connecting Cycle",
    slug: "network-connecting-cycle",
    definition: CONNECT_DEFINITION as unknown as Record<string, unknown>,
  }).run();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ============================================================
// activate_cycle
// ============================================================

describe("activate_cycle", () => {
  it("creates and starts a sales-marketing cycle with user config", async () => {
    const result = await handleActivateCycle({
      cycleType: "sales-marketing",
      goals: "Fill pipeline with 10 qualified leads per month",
      icp: "B2B SaaS companies, 50-200 employees",
    });

    expect(result.success).toBe(true);
    expect(result.toolName).toBe("activate_cycle");
    expect(result.metadata?.cycleType).toBe("sales-marketing");
    expect(result.metadata?.runId).toBeDefined();

    // Verify process run was created
    const runs = testDb
      .select()
      .from(schema.processRuns)
      .all();
    expect(runs.length).toBeGreaterThan(0);
  });

  it("returns continuous operation framing", async () => {
    const result = await handleActivateCycle({
      cycleType: "sales-marketing",
      goals: "Grow revenue",
      icp: "SMBs",
    });

    expect(result.success).toBe(true);
    // AC2: framed as continuous operation
    expect(result.output).toContain("continuous");
    expect(result.output).not.toContain("I'll research your targets");
  });

  it("rejects unknown cycle type", async () => {
    const result = await handleActivateCycle({
      cycleType: "unknown-cycle",
      goals: "test",
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown cycle type");
  });

  it("requires goals or ICP", async () => {
    const result = await handleActivateCycle({
      cycleType: "sales-marketing",
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("goal or ICP");
  });

  it("prevents duplicate active cycles", async () => {
    // Activate first
    const first = await handleActivateCycle({
      cycleType: "sales-marketing",
      goals: "First goal",
      icp: "Tech companies",
    });
    expect(first.success).toBe(true);

    const runId = first.metadata?.runId as string;

    // Mark it as running with cycleType set
    testDb.update(schema.processRuns)
      .set({ status: "running", cycleType: "sales-marketing" })
      .where(eq(schema.processRuns.id, runId))
      .run();

    // Try to activate again
    const second = await handleActivateCycle({
      cycleType: "sales-marketing",
      goals: "Second goal",
      icp: "Different companies",
    });

    expect(second.success).toBe(false);
    expect(second.output).toContain("already running");
  });
});

// ============================================================
// pause_cycle / resume_cycle
// ============================================================

describe("pause_cycle and resume_cycle", () => {
  it("pauses a running cycle (status -> paused)", async () => {
    const activate = await handleActivateCycle({
      cycleType: "sales-marketing",
      goals: "Test",
      icp: "Test",
    });
    const runId = activate.metadata?.runId as string;

    testDb.update(schema.processRuns)
      .set({ status: "running", cycleType: "sales-marketing" })
      .where(eq(schema.processRuns.id, runId))
      .run();

    const pauseResult = await handlePauseCycle({ cycleType: "sales-marketing" });
    expect(pauseResult.success).toBe(true);

    const [run] = testDb
      .select({ status: schema.processRuns.status })
      .from(schema.processRuns)
      .where(eq(schema.processRuns.id, runId))
      .all();
    expect(run.status).toBe("paused");
  });

  it("resumes a paused cycle (status -> running)", async () => {
    const activate = await handleActivateCycle({
      cycleType: "sales-marketing",
      goals: "Test",
      icp: "Test",
    });
    const runId = activate.metadata?.runId as string;

    testDb.update(schema.processRuns)
      .set({ status: "paused", cycleType: "sales-marketing" })
      .where(eq(schema.processRuns.id, runId))
      .run();

    const resumeResult = await handleResumeCycle({ cycleType: "sales-marketing" });
    expect(resumeResult.success).toBe(true);

    const [run] = testDb
      .select({ status: schema.processRuns.status })
      .from(schema.processRuns)
      .where(eq(schema.processRuns.id, runId))
      .all();
    expect(run.status).toBe("running");
  });

  it("returns error when no cycle to pause", async () => {
    const result = await handlePauseCycle({ cycleType: "sales-marketing" });
    expect(result.success).toBe(false);
    expect(result.output).toContain("No active");
  });
});

// ============================================================
// cycle_briefing
// ============================================================

describe("cycle_briefing", () => {
  it("produces four-section briefing: context, summary, recommendations, options", async () => {
    const activate = await handleActivateCycle({
      cycleType: "sales-marketing",
      goals: "Fill pipeline",
      icp: "B2B SaaS",
    });
    const runId = activate.metadata?.runId as string;

    // Set cycle metadata
    testDb.update(schema.processRuns)
      .set({
        status: "running",
        cycleType: "sales-marketing",
        cycleConfig: { goals: "Fill pipeline", icp: "B2B SaaS", continuous: true } as Record<string, unknown>,
        startedAt: new Date(),
        currentStepId: "assess",
      })
      .where(eq(schema.processRuns.id, runId))
      .run();

    // Add a completed step
    testDb.insert(schema.stepRuns).values({
      processRunId: runId,
      stepId: "sense",
      status: "approved",
      executorType: "ai-agent",
    }).run();

    // Add a pending review step
    testDb.insert(schema.stepRuns).values({
      processRunId: runId,
      stepId: "assess",
      status: "waiting_review",
      executorType: "ai-agent",
    }).run();

    const result = await handleCycleBriefing({ cycleType: "sales-marketing" });

    expect(result.success).toBe(true);
    // AC4: four sections
    expect(result.output).toContain("**Context**");
    expect(result.output).toContain("**Summary**");
    expect(result.output).toContain("**Recommendations**");
    expect(result.output).toContain("**Options**");
    expect(result.metadata?.completedSteps).toBe(1);
    expect(result.metadata?.pendingReviews).toBe(1);
  });
});

// ============================================================
// cycle_status
// ============================================================

describe("cycle_status", () => {
  it("returns active cycles with current phase and pending reviews", async () => {
    // Create two active cycles
    const sales = await handleActivateCycle({
      cycleType: "sales-marketing",
      goals: "Sales goal",
      icp: "Tech",
    });
    testDb.update(schema.processRuns)
      .set({
        status: "running",
        cycleType: "sales-marketing",
        currentStepId: "act",
      })
      .where(eq(schema.processRuns.id, sales.metadata?.runId as string))
      .run();

    const connect = await handleActivateCycle({
      cycleType: "network-connecting",
      goals: "Connect goal",
      icp: "People",
    });
    testDb.update(schema.processRuns)
      .set({
        status: "running",
        cycleType: "network-connecting",
        currentStepId: "sense",
      })
      .where(eq(schema.processRuns.id, connect.metadata?.runId as string))
      .run();

    const result = await handleCycleStatus({});

    expect(result.success).toBe(true);
    expect(result.output).toContain("Operating Cycles");
    expect(result.output).toContain("sales-marketing");
    expect(result.output).toContain("network-connecting");
    expect(result.metadata?.activeCycles).toContain("sales-marketing");
    expect(result.metadata?.activeCycles).toContain("network-connecting");
  });

  it("shows empty state when no cycles active", async () => {
    const result = await handleCycleStatus({});
    expect(result.success).toBe(true);
    expect(result.output).toContain("No operating cycles active");
  });
});

// ============================================================
// Network tools cycle-aware (Brief 118 AC6, AC7)
// ============================================================

describe("network tools cycle-aware", () => {
  it("create_sales_plan activates a sales-marketing cycle", async () => {
    const { handleCreateSalesPlan } = await import("./network-tools");

    const result = await handleCreateSalesPlan({
      goal: "Get 10 new clients",
      icp: "SMB tech companies",
      cadence: "daily",
    });

    expect(result.success).toBe(true);
    expect(result.toolName).toBe("create_sales_plan");
    expect(result.metadata?.cycleType).toBe("sales-marketing");
    expect(result.metadata?.mode).toBe("selling");
  });
});

// ============================================================
// Tool registration (Brief 118 AC8)
// ============================================================

describe("cycle tools registered in selfTools", () => {
  it("all 5 cycle tools are registered", async () => {
    const { selfTools } = await import("../self-delegation");

    const cycleToolNames = [
      "activate_cycle",
      "pause_cycle",
      "resume_cycle",
      "cycle_briefing",
      "cycle_status",
    ];

    for (const name of cycleToolNames) {
      const found = selfTools.find((t) => t.name === name);
      expect(found, `Tool "${name}" should be registered`).toBeDefined();
    }
  });
});
