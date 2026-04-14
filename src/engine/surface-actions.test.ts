/**
 * Tests for surface-actions.ts — Brief 145 (MP-1.2b)
 *
 * Tests: process_proposal form handler returns conversationContext with activation data.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock self-delegation's executeDelegation
const mockExecuteDelegation = vi.fn();
vi.mock("./self-delegation", () => ({
  executeDelegation: (...args: unknown[]) => mockExecuteDelegation(...args),
}));

// Mock review-actions (not used in these tests but imported by surface-actions)
vi.mock("./review-actions", () => ({
  approveRun: vi.fn(),
  editRun: vi.fn(),
  rejectRun: vi.fn(),
}));

// Mock suggestion-dismissals
vi.mock("./suggestion-dismissals", () => ({
  recordDismissal: vi.fn(),
}));

const { handleSurfaceAction, registerAction } = await import("./surface-actions");

beforeEach(() => {
  mockExecuteDelegation.mockReset();
});

describe("process_proposal form handler (MP-1.2b)", () => {
  it("returns conversationContext with activation data after successful creation", async () => {
    // Register the form-submit token
    registerAction("form-submit:process_proposal", "test-session", { blockType: "process_proposal" });

    // Mock generate_process returning a saved result with slug
    mockExecuteDelegation.mockResolvedValue({
      toolName: "generate_process",
      success: true,
      output: JSON.stringify({
        action: "saved",
        id: "proc-123",
        slug: "my-quote-process",
        name: "My Quote Process",
        stepCount: 2,
        status: "draft",
        activationHint: true,
        processSlug: "my-quote-process",
        message: "Process saved",
      }),
    });

    const result = await handleSurfaceAction("user-1", "form-submit", {
      blockType: "process_proposal",
      values: {
        name: "My Quote Process",
        description: "Generate quotes",
        steps: ["Research", "Draft"],
      },
    });

    expect(result.success).toBe(true);
    expect(result.conversationContext).toBeDefined();
    expect(result.conversationContext?.activationReady).toBe(true);
    expect(result.conversationContext?.processSlug).toBe("my-quote-process");
    expect(result.conversationContext?.processName).toBe("My Quote Process");
  });

  it("does not include conversationContext on failed creation", async () => {
    registerAction("form-submit:process_proposal", "test-session", { blockType: "process_proposal" });

    mockExecuteDelegation.mockResolvedValue({
      toolName: "generate_process",
      success: false,
      output: "Validation error: something went wrong",
    });

    const result = await handleSurfaceAction("user-1", "form-submit", {
      blockType: "process_proposal",
      values: {
        name: "Bad Process",
        description: "This will fail",
        steps: [],
      },
    });

    expect(result.success).toBe(false);
    expect(result.conversationContext).toBeUndefined();
  });
});
