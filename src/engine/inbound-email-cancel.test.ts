/**
 * Cancellation Detection Tests (Brief 125)
 *
 * Tests: isCancellationSignal() keyword detection + cancellation flow
 * via processInboundEmail().
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../test-utils";
import * as schema from "../db/schema";
import type { RunStatus } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

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

// Mock heartbeat — track pauseGoal calls
const { mockPauseGoal } = vi.hoisted(() => ({
  mockPauseGoal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./heartbeat", () => ({
  resumeHumanStep: vi.fn(async (processRunId: string) => ({
    processRunId,
    stepsExecuted: 1,
    status: "advanced",
    message: "Resumed from email",
  })),
  pauseGoal: mockPauseGoal,
  startProcessRun: vi.fn(async () => "mock-run-id"),
  fullHeartbeat: vi.fn(async () => ({
    processRunId: "mock-run-id",
    stepsExecuted: 1,
    status: "completed",
    message: "mock",
  })),
}));

// Mock integration registry
vi.mock("./integration-registry", () => ({
  getIntegration: vi.fn(() => undefined),
  getIntegrationRegistry: vi.fn(),
  clearRegistryCache: vi.fn(),
}));

// Mock channel
vi.mock("./channel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./channel")>();
  return {
    ...actual,
    sendAndRecord: vi.fn(async () => ({
      success: true,
      interactionId: "mock-interaction-id",
      messageId: "mock-message-id",
    })),
  };
});

// Mock notify-user
const { mockNotifyUser } = vi.hoisted(() => ({
  mockNotifyUser: vi.fn().mockResolvedValue({ success: true, channel: "email", interactionId: "mock-notify-id" }),
}));
vi.mock("./notify-user", () => ({
  notifyUser: mockNotifyUser,
}));

// Mock selfConverse
const { mockSelfConverse } = vi.hoisted(() => ({
  mockSelfConverse: vi.fn().mockResolvedValue({
    response: "Got it.",
    sessionId: "mock-session-id",
    delegationsExecuted: 0,
    consultationsExecuted: 0,
    costCents: 1,
  }),
}));
vi.mock("./self", () => ({
  selfConverse: mockSelfConverse,
}));

import { isCancellationSignal, processInboundEmail, type InboundEmailPayload } from "./inbound-email";

beforeEach(() => {
  const result = createTestDb();
  testDb = result.db;
  cleanup = result.cleanup;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ============================================================
// isCancellationSignal() — keyword detection
// ============================================================

describe("isCancellationSignal", () => {
  // AC3: "cancel this" → true
  it('returns true for "cancel this"', () => {
    expect(isCancellationSignal("cancel this")).toBe(true);
  });

  // AC4: "stop everything" → true
  it('returns true for "stop everything"', () => {
    expect(isCancellationSignal("stop everything")).toBe(true);
  });

  // AC5: "never mind" → true
  it('returns true for "never mind"', () => {
    expect(isCancellationSignal("never mind")).toBe(true);
  });

  // AC6: "that sounds great" → false
  it('returns false for "that sounds great"', () => {
    expect(isCancellationSignal("that sounds great")).toBe(false);
  });

  // AC7: "maybe hold off" → false (ambiguous → routes to Self)
  it('returns false for "maybe hold off" (ambiguous)', () => {
    expect(isCancellationSignal("maybe hold off")).toBe(false);
  });

  // Additional coverage
  it("returns true for exact signals", () => {
    expect(isCancellationSignal("cancel")).toBe(true);
    expect(isCancellationSignal("stop")).toBe(true);
    expect(isCancellationSignal("nevermind")).toBe(true);
    expect(isCancellationSignal("abort")).toBe(true);
    expect(isCancellationSignal("hold off")).toBe(true);
    expect(isCancellationSignal("pause")).toBe(true);
    expect(isCancellationSignal("don't do this")).toBe(true);
  });

  it("returns true for prefix signals", () => {
    expect(isCancellationSignal("please cancel all outreach")).toBe(true);
    expect(isCancellationSignal("please stop sending emails")).toBe(true);
    expect(isCancellationSignal("don't send anything")).toBe(true);
    expect(isCancellationSignal("do not contact them")).toBe(true);
  });

  it("returns true for substring signals", () => {
    expect(isCancellationSignal("I need you to cancel this outreach")).toBe(true);
    expect(isCancellationSignal("can you kill this")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isCancellationSignal("CANCEL THIS")).toBe(true);
    expect(isCancellationSignal("Stop Everything")).toBe(true);
    expect(isCancellationSignal("Never Mind")).toBe(true);
  });

  it("returns false for positive responses", () => {
    expect(isCancellationSignal("sounds good")).toBe(false);
    expect(isCancellationSignal("yes please")).toBe(false);
    expect(isCancellationSignal("go ahead")).toBe(false);
    expect(isCancellationSignal("looks great, send it")).toBe(false);
  });

  it("returns false for ambiguous/hedging language", () => {
    expect(isCancellationSignal("maybe hold off")).toBe(false);
    expect(isCancellationSignal("I'm not sure about this")).toBe(false);
    expect(isCancellationSignal("hmm let me think")).toBe(false);
    expect(isCancellationSignal("could we wait a bit?")).toBe(false);
  });
});

// ============================================================
// Email cancellation flow
// ============================================================

async function createNetworkUser(opts: {
  email: string;
  name?: string;
}) {
  const userId = randomUUID();
  const personId = randomUUID();

  await testDb.insert(schema.people).values({
    id: personId,
    userId,
    name: opts.name ?? "Test User",
    email: opts.email,
    source: "manual",
  });

  await testDb.insert(schema.networkUsers).values({
    id: userId,
    email: opts.email,
    name: opts.name ?? "Test User",
    status: "active",
    personId,
  });

  return { userId, personId };
}

async function createGoalWithProcess(userId: string) {
  const processId = randomUUID();
  const runId = randomUUID();
  const goalId = randomUUID();
  const threadId = `thread-${randomUUID().slice(0, 8)}`;

  await testDb.insert(schema.processes).values({
    id: processId,
    name: "Front Door Intake",
    slug: "front-door-intake-" + runId.slice(0, 8),
    description: "test",
    definition: {},
    status: "active",
    trustTier: "autonomous",
  });

  await testDb.insert(schema.processRuns).values({
    id: runId,
    processId,
    status: "in_progress" as RunStatus,
    triggeredBy: "front-door",
    inputs: { userId },
  });

  // Create goal work item referencing this process run
  await testDb.insert(schema.workItems).values({
    id: goalId,
    type: "goal",
    content: "Find accountants in Wellington",
    source: "conversation",
    status: "in_progress",
    executionIds: [runId],
  });

  // Create the target person (the contact who received the outreach)
  const targetPersonId = randomUUID();
  await testDb.insert(schema.people).values({
    id: targetPersonId,
    userId,
    name: "Sarah Target",
    email: "sarah@example.com",
    source: "manual",
  });

  // Create an interaction in this thread (the outreach that was sent)
  await testDb.insert(schema.interactions).values({
    id: randomUUID(),
    personId: targetPersonId,
    userId,
    type: "outreach_sent",
    channel: "email",
    mode: "connecting",
    subject: "Introduction from Alex",
    summary: "Hi Sarah, I work with...",
    processRunId: runId,
    metadata: {
      messageId: `msg-${randomUUID().slice(0, 8)}`,
      threadId,
      body: "Hi Sarah, I work with a commercial cleaning company...",
    },
  });

  return { processId, runId, goalId, threadId };
}

describe("email cancellation flow", () => {
  // AC8-9: Cancellation detected → goal paused + confirmation email
  it("pauses goal and sends confirmation when user cancels via email", async () => {
    const { userId } = await createNetworkUser({ email: "boss@example.com" });
    const { goalId, threadId } = await createGoalWithProcess(userId);

    const payload: InboundEmailPayload = {
      eventType: "message.received",
      message: {
        from: "boss@example.com",
        subject: "Re: Introduction from Alex",
        text: "cancel this",
        threadId: threadId,
        messageId: "inbound-msg-1",
      },
    };

    const result = await processInboundEmail(payload);

    expect(result.action).toBe("cancellation");
    expect(mockPauseGoal).toHaveBeenCalledWith(goalId);
    expect(mockNotifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("paused"),
      }),
    );
  });

  // AC10: Ambiguous cancellation → routes to Self
  it("routes ambiguous cancellation to Self", async () => {
    await createNetworkUser({ email: "boss@example.com" });

    const payload: InboundEmailPayload = {
      eventType: "message.received",
      message: {
        from: "boss@example.com",
        subject: "Re: Introduction from Alex",
        text: "maybe hold off on this",
        threadId: "some-thread",
        messageId: "inbound-msg-2",
      },
    };

    const result = await processInboundEmail(payload);

    // Should NOT have paused anything
    expect(mockPauseGoal).not.toHaveBeenCalled();
    // Should route to Self
    expect(result.action).toBe("user_request");
    expect(mockSelfConverse).toHaveBeenCalled();
  });

  // AC12: Thread-context resolution identifies correct goal
  it("resolves correct goal from thread context", async () => {
    const { userId } = await createNetworkUser({ email: "boss@example.com" });
    const goal1 = await createGoalWithProcess(userId);
    const goal2 = await createGoalWithProcess(userId);

    // Cancel in goal2's thread
    const payload: InboundEmailPayload = {
      eventType: "message.received",
      message: {
        from: "boss@example.com",
        subject: "Re: Different Outreach",
        text: "stop this",
        threadId: goal2.threadId,
        messageId: "inbound-msg-3",
      },
    };

    const result = await processInboundEmail(payload);

    expect(result.action).toBe("cancellation");
    // Should pause goal2, not goal1
    expect(mockPauseGoal).toHaveBeenCalledWith(goal2.goalId);
    expect(mockPauseGoal).not.toHaveBeenCalledWith(goal1.goalId);
  });

  // AC13: Non-owner cannot cancel
  it("does not pause goal when email is from non-owner", async () => {
    // Create user A who owns the goal
    const { userId: userAId } = await createNetworkUser({ email: "usera@example.com" });
    const { threadId } = await createGoalWithProcess(userAId);

    // Create user B (different user)
    await createNetworkUser({ email: "userb@example.com" });

    // User B sends cancel in user A's thread — but resolveGoalFromThread
    // filters by userId, so it won't find a match for user B
    const payload: InboundEmailPayload = {
      eventType: "message.received",
      message: {
        from: "userb@example.com",
        subject: "Re: Introduction from Alex",
        text: "cancel this",
        threadId: threadId,
        messageId: "inbound-msg-4",
      },
    };

    const result = await processInboundEmail(payload);

    // Should NOT pause — user B doesn't own the goal
    expect(mockPauseGoal).not.toHaveBeenCalled();
    // Falls through to Self routing since no goal context found for user B
    expect(result.action).toBe("user_request");
  });

  it("falls through to Self when cancellation has no thread context", async () => {
    await createNetworkUser({ email: "boss@example.com" });

    const payload: InboundEmailPayload = {
      eventType: "message.received",
      message: {
        from: "boss@example.com",
        subject: "Cancel everything",
        text: "cancel everything",
        // No threadId — can't resolve which goal
        messageId: "inbound-msg-5",
      },
    };

    const result = await processInboundEmail(payload);

    expect(mockPauseGoal).not.toHaveBeenCalled();
    expect(result.action).toBe("user_request");
    expect(mockSelfConverse).toHaveBeenCalled();
  });
});
