/**
 * Tests for heartbeat step primitives: schedule, wait_for, gate, email_thread (Brief 121).
 *
 * These test the primitive evaluation functions and process-loader validation.
 * Full integration tests require the harness pipeline which is tested separately.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseDuration } from "@ditto/core";
import {
  validateSchedulePrimitives,
  flattenSteps,
  type ProcessDefinition,
} from "./process-loader";
import { makeTestProcessDefinition, createTestDb, type TestDb } from "../test-utils";
import * as schema from "../db/schema";

// ============================================================
// parseDuration integration (AC1/AC2 verified in core tests, quick smoke here)
// ============================================================

describe("parseDuration smoke", () => {
  it("parses standard durations used in process templates", () => {
    expect(parseDuration("24h")).toBe(24 * 60 * 60 * 1000);
    expect(parseDuration("48h")).toBe(48 * 60 * 60 * 1000);
    expect(parseDuration("7d")).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// ============================================================
// Schedule validation (process-loader)
// ============================================================

describe("validateSchedulePrimitives", () => {
  it("accepts valid schedule with trigger reference", () => {
    const def = makeTestProcessDefinition({
      steps: [
        {
          id: "step-a",
          name: "Step A",
          executor: "ai-agent",
        },
        {
          id: "step-b",
          name: "Step B",
          executor: "ai-agent",
          schedule: { delay: "24h", after: "trigger" },
        },
      ],
    }) as ProcessDefinition;

    const errors = validateSchedulePrimitives(def);
    expect(errors).toHaveLength(0);
  });

  it("accepts valid schedule with step reference", () => {
    const def = makeTestProcessDefinition({
      steps: [
        {
          id: "step-a",
          name: "Step A",
          executor: "ai-agent",
        },
        {
          id: "step-b",
          name: "Step B",
          executor: "ai-agent",
          schedule: { delay: "4h", after: "step-a" },
        },
      ],
    }) as ProcessDefinition;

    const errors = validateSchedulePrimitives(def);
    expect(errors).toHaveLength(0);
  });

  it("rejects invalid delay format", () => {
    const def = makeTestProcessDefinition({
      steps: [
        {
          id: "step-a",
          name: "Step A",
          executor: "ai-agent",
          schedule: { delay: "invalid", after: "trigger" },
        },
      ],
    }) as ProcessDefinition;

    const errors = validateSchedulePrimitives(def);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid");
    expect(errors[0]).toContain("schedule.delay");
  });

  it("rejects schedule.after referencing non-existent step", () => {
    const def = makeTestProcessDefinition({
      steps: [
        {
          id: "step-a",
          name: "Step A",
          executor: "ai-agent",
          schedule: { delay: "4h", after: "nonexistent" },
        },
      ],
    }) as ProcessDefinition;

    const errors = validateSchedulePrimitives(def);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("nonexistent");
    expect(errors[0]).toContain("schedule.after");
  });
});

// ============================================================
// Gate primitive type structure
// ============================================================

describe("gate primitive on StepDefinition", () => {
  it("gate field is accessible on parsed step definitions", () => {
    const def = makeTestProcessDefinition({
      steps: [
        {
          id: "nudge",
          name: "Day 2 Nudge",
          executor: "ai-agent",
          gate: { engagement: "silent", since_step: "initial-email", fallback: "skip" },
        },
      ],
    }) as ProcessDefinition;

    const steps = flattenSteps(def);
    expect(steps[0].gate).toEqual({
      engagement: "silent",
      since_step: "initial-email",
      fallback: "skip",
    });
  });
});

// ============================================================
// wait_for primitive type structure
// ============================================================

describe("wait_for primitive on StepDefinition", () => {
  it("wait_for field is accessible on parsed step definitions", () => {
    const def = makeTestProcessDefinition({
      steps: [
        {
          id: "initial-email",
          name: "Initial Email",
          executor: "ai-agent",
          wait_for: { event: "reply", timeout: "48h" },
        },
      ],
    }) as ProcessDefinition;

    const steps = flattenSteps(def);
    expect(steps[0].wait_for).toEqual({
      event: "reply",
      timeout: "48h",
    });
  });

  it("wait_for defaults timeout behavior (parsed as-is, default applied at runtime)", () => {
    const def = makeTestProcessDefinition({
      steps: [
        {
          id: "step-a",
          name: "Step A",
          executor: "ai-agent",
          wait_for: { event: "reply" },
        },
      ],
    }) as ProcessDefinition;

    const steps = flattenSteps(def);
    expect(steps[0].wait_for?.event).toBe("reply");
    expect(steps[0].wait_for?.timeout).toBeUndefined();
  });
});

// ============================================================
// email_thread primitive type structure
// ============================================================

describe("email_thread primitive on StepDefinition", () => {
  it("email_thread field is accessible on parsed step definitions", () => {
    const def = makeTestProcessDefinition({
      steps: [
        {
          id: "initial-email",
          name: "Initial Email",
          executor: "ai-agent",
          email_thread: "onboarding",
        },
        {
          id: "follow-up",
          name: "Follow Up",
          executor: "ai-agent",
          email_thread: "onboarding",
          depends_on: ["initial-email"],
        },
      ],
    }) as ProcessDefinition;

    const steps = flattenSteps(def);
    expect(steps[0].email_thread).toBe("onboarding");
    expect(steps[1].email_thread).toBe("onboarding");
  });
});

// ============================================================
// Composed primitives (the typical advisor flow from Insight 171)
// ============================================================

describe("composed primitives", () => {
  it("a step can have schedule + gate + email_thread + wait_for", () => {
    const def = makeTestProcessDefinition({
      steps: [
        {
          id: "initial-email",
          name: "Initial Email",
          executor: "ai-agent",
          email_thread: "onboarding",
          wait_for: { event: "reply", timeout: "48h" },
        },
        {
          id: "day-2-nudge",
          name: "Day 2 Nudge",
          executor: "ai-agent",
          email_thread: "onboarding",
          schedule: { delay: "24h", after: "trigger" },
          gate: { engagement: "silent", since_step: "initial-email", fallback: "skip" },
        },
      ],
    }) as ProcessDefinition;

    const steps = flattenSteps(def);
    const nudge = steps[1];

    expect(nudge.email_thread).toBe("onboarding");
    expect(nudge.schedule?.delay).toBe("24h");
    expect(nudge.gate?.engagement).toBe("silent");
    expect(nudge.gate?.fallback).toBe("skip");
  });
});

// ============================================================
// DB column: deferredUntil on stepRuns
// ============================================================

describe("deferredUntil column", () => {
  let testDb: TestDb;
  let cleanup: () => void;

  beforeEach(() => {
    const result = createTestDb();
    testDb = result.db;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("stepRuns table accepts deferredUntil value", async () => {
    // Create prerequisite records
    const processId = "test-proc-id";
    const runId = "test-run-id";
    const deferDate = new Date("2026-04-11T12:00:00Z");

    await testDb.insert(schema.processes).values({
      id: processId,
      name: "Test",
      slug: "test",
      definition: {},
    });

    await testDb.insert(schema.processRuns).values({
      id: runId,
      processId,
      triggeredBy: "test",
    });

    await testDb.insert(schema.stepRuns).values({
      processRunId: runId,
      stepId: "step-1",
      executorType: "ai-agent",
      deferredUntil: deferDate,
    });

    const [stepRun] = await testDb
      .select()
      .from(schema.stepRuns);

    expect(stepRun.deferredUntil).toEqual(deferDate);
  });

  it("deferredUntil defaults to null", async () => {
    const processId = "test-proc-id-2";
    const runId = "test-run-id-2";

    await testDb.insert(schema.processes).values({
      id: processId,
      name: "Test 2",
      slug: "test-2",
      definition: {},
    });

    await testDb.insert(schema.processRuns).values({
      id: runId,
      processId,
      triggeredBy: "test",
    });

    await testDb.insert(schema.stepRuns).values({
      processRunId: runId,
      stepId: "step-1",
      executorType: "ai-agent",
    });

    const [stepRun] = await testDb
      .select()
      .from(schema.stepRuns);

    expect(stepRun.deferredUntil).toBeNull();
  });
});
