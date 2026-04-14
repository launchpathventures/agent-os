/**
 * Tests for generate_process — Brief 145 (MP-1.1, MP-1.2)
 *
 * Tests: template matching integration, activation hint in result,
 * and no-regression for from-scratch generation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../../test-utils";
import * as schema from "../../db/schema";

let testDb: TestDb;
let cleanup: () => void;

vi.mock("../../db", async () => {
  const realSchema = await vi.importActual<typeof import("../../db/schema")>("../../db/schema");
  return {
    get db() { return testDb; },
    schema: realSchema,
  };
});

// Mock process-model-lookup — we control match results per test
const mockFindProcessModel = vi.fn();
vi.mock("../system-agents/process-model-lookup", () => ({
  findProcessModel: (...args: unknown[]) => mockFindProcessModel(...args),
}));

// Import after mocks
const { handleGenerateProcess } = await import("./generate-process");

const BASIC_STEPS = [
  { id: "research", name: "Research", executor: "ai-agent", description: "Research the topic" },
  { id: "draft", name: "Draft", executor: "ai-agent", description: "Write first draft" },
];

beforeEach(() => {
  const result = createTestDb();
  testDb = result.db;
  cleanup = result.cleanup;
  mockFindProcessModel.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ============================================================
// Template matching (MP-1.1)
// ============================================================

describe("template matching (MP-1.1)", () => {
  it("calls findProcessModel with the process description", async () => {
    mockFindProcessModel.mockResolvedValue(null);

    await handleGenerateProcess({
      name: "Quote Generation",
      description: "Generate quotes for customers",
      steps: BASIC_STEPS,
      save: false,
    });

    expect(mockFindProcessModel).toHaveBeenCalledWith("Generate quotes for customers");
  });

  it("uses template structure when confidence >= 0.6", async () => {
    // Create a temp template YAML file
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ditto-test-"));
    const templatePath = path.join(tmpDir, "quote-template.yaml");
    fs.writeFileSync(templatePath, `
name: Quote Template
id: quote-template
version: 1
status: active
description: Standard quoting process
trigger:
  type: manual
  description: Generate a quote
inputs:
  - name: customer
    type: string
    description: Customer name
steps:
  - id: gather-info
    name: Gather Information
    executor: ai-agent
    description: Collect customer requirements
  - id: calculate
    name: Calculate Pricing
    executor: script
    description: Run pricing calculation
  - id: review
    name: Human Review
    executor: human
    description: Review the quote
`);

    mockFindProcessModel.mockResolvedValue({
      slug: "quote-template",
      name: "Quote Template",
      description: "Standard quoting process",
      confidence: 0.75,
      reasoning: "keyword match",
      templatePath,
    });

    const result = await handleGenerateProcess({
      name: "My Quote Process",
      description: "Generate quotes for customers",
      steps: BASIC_STEPS,
      save: false,
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.templateUsed).toBe("quote-template");

    // Verify template step names are in the YAML
    expect(output.yaml).toContain("Gather Information");
    expect(output.yaml).toContain("Calculate Pricing");
    expect(output.yaml).toContain("Human Review");

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("mentions template as inspiration when confidence 0.3-0.6", async () => {
    mockFindProcessModel.mockResolvedValue({
      slug: "similar-process",
      name: "Similar Process",
      description: "A somewhat similar process",
      confidence: 0.45,
      reasoning: "partial match",
      templatePath: "",
    });

    const result = await handleGenerateProcess({
      name: "My Process",
      description: "Do something similar",
      steps: BASIC_STEPS,
      save: false,
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.templateInspiration).toBe("similar-process");
    expect(output.message).toContain("similar template");
  });

  it("proceeds from scratch when confidence < 0.3", async () => {
    mockFindProcessModel.mockResolvedValue(null); // Below threshold returns null

    const result = await handleGenerateProcess({
      name: "Unique Process",
      description: "Something completely new",
      steps: BASIC_STEPS,
      save: false,
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.templateUsed).toBeUndefined();
    expect(output.templateInspiration).toBeUndefined();
    // Uses user-provided steps
    expect(output.yaml).toContain("Research");
    expect(output.yaml).toContain("Draft");
  });

  it("proceeds from scratch when findProcessModel throws", async () => {
    mockFindProcessModel.mockRejectedValue(new Error("DB error"));

    const result = await handleGenerateProcess({
      name: "My Process",
      description: "A process",
      steps: BASIC_STEPS,
      save: false,
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.templateUsed).toBeUndefined();
  });
});

// ============================================================
// Activation hint (MP-1.2)
// ============================================================

describe("activation hint (MP-1.2)", () => {
  it("includes activationHint and processSlug after save=true", async () => {
    mockFindProcessModel.mockResolvedValue(null);

    const result = await handleGenerateProcess({
      name: "Test Activation Process",
      description: "Testing activation hint",
      steps: BASIC_STEPS,
      save: true,
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.activationHint).toBe(true);
    expect(output.processSlug).toBe("test-activation-process");
    expect(output.action).toBe("saved");
  });

  it("does not include activationHint in preview mode (save=false)", async () => {
    mockFindProcessModel.mockResolvedValue(null);

    const result = await handleGenerateProcess({
      name: "Preview Process",
      description: "Testing preview",
      steps: BASIC_STEPS,
      save: false,
    });

    expect(result.success).toBe(true);
    const output = JSON.parse(result.output);
    expect(output.activationHint).toBeUndefined();
    expect(output.action).toBe("preview");
  });
});

// ============================================================
// No regression — existing behavior
// ============================================================

describe("existing behavior (no regression)", () => {
  it("validates required fields", async () => {
    const result = await handleGenerateProcess({
      name: "",
      description: "test",
      steps: BASIC_STEPS,
      save: false,
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("required");
  });

  it("validates step structure", async () => {
    mockFindProcessModel.mockResolvedValue(null);

    const result = await handleGenerateProcess({
      name: "Test",
      description: "test",
      steps: [{ id: "s1", name: "Step 1", executor: "invalid-executor" }],
      save: false,
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("invalid executor");
  });

  it("rejects duplicate slug on save", async () => {
    mockFindProcessModel.mockResolvedValue(null);

    // First save
    const first = await handleGenerateProcess({
      name: "Unique Name",
      description: "test",
      steps: BASIC_STEPS,
      save: true,
    });
    expect(first.success).toBe(true);

    // Second save with same name
    const second = await handleGenerateProcess({
      name: "Unique Name",
      description: "test again",
      steps: BASIC_STEPS,
      save: true,
    });
    expect(second.success).toBe(false);
    expect(second.output).toContain("already exists");
  });
});
