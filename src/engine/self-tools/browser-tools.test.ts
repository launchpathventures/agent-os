/**
 * Tests for Browser self-tool (browse_web).
 *
 * Tests cover: input validation, WRITE intent detection, URL normalization,
 * error handling, token budget enforcement, activity logging.
 *
 * Stagehand is mocked — these are unit tests, not integration tests
 * that launch a real browser.
 *
 * Provenance: Brief 134.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../../test-utils";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";

let testDb: TestDb;
let cleanup: () => void;

vi.mock("../../db", async () => {
  const realSchema = await vi.importActual<typeof import("../../db/schema")>("../../db/schema");
  return {
    get db() { return testDb; },
    schema: realSchema,
  };
});

// Mock Stagehand — we don't launch a real browser in tests
const mockExtract = vi.fn();
const mockClose = vi.fn();
const mockGoto = vi.fn();
const mockInit = vi.fn();

// Stagehand exports { Stagehand } where Stagehand is the V3 class.
// We need a proper constructor function for `new Stagehand(...)`.
class MockStagehand {
  init = mockInit;
  context = { pages: () => [{ goto: mockGoto }] };
  extract = mockExtract;
  metrics = Promise.resolve({
    totalPromptTokens: 100,
    totalCompletionTokens: 50,
  });
  close = mockClose;
}

vi.mock("@browserbasehq/stagehand", () => ({
  Stagehand: MockStagehand,
}));

// Mock DNS resolution — resolve all test domains to a public IP by default
const mockLookup = vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 });
vi.mock("dns/promises", () => ({
  lookup: (...args: unknown[]) => mockLookup(...args),
}));

const { handleBrowseWeb } = await import("./browser-tools");

describe("browse_web self-tool", () => {
  beforeEach(() => {
    const result = createTestDb();
    testDb = result.db;
    cleanup = result.cleanup;
    vi.clearAllMocks();
    mockExtract.mockResolvedValue({ extraction: "Extracted content here" });
    mockInit.mockResolvedValue(undefined);
    mockGoto.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  // ==============================================================
  // Input validation
  // ==============================================================

  it("rejects when neither url nor query provided", async () => {
    const result = await handleBrowseWeb({
      extractionGoal: "Find recent posts",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("URL or search query is required");
  });

  it("rejects empty extraction goal", async () => {
    const result = await handleBrowseWeb({
      url: "https://example.com",
      extractionGoal: "",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("extraction goal is required");
  });

  it("rejects whitespace-only extraction goal", async () => {
    const result = await handleBrowseWeb({
      url: "https://example.com",
      extractionGoal: "   ",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("extraction goal is required");
  });

  // ==============================================================
  // WRITE intent detection (AC-5)
  // ==============================================================

  it("refuses submit intent", async () => {
    const result = await handleBrowseWeb({
      url: "https://example.com",
      extractionGoal: "Submit the contact form with my details",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("READ-only");
  });

  it("refuses send message intent", async () => {
    const result = await handleBrowseWeb({
      url: "https://linkedin.com/in/someone",
      extractionGoal: "Send a connection request to this person",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("READ-only");
  });

  it("refuses sign up intent", async () => {
    const result = await handleBrowseWeb({
      url: "https://example.com",
      extractionGoal: "Sign up for a free account",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("READ-only");
  });

  it("refuses DM intent", async () => {
    const result = await handleBrowseWeb({
      url: "https://twitter.com/someone",
      extractionGoal: "DM this person about our product",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("READ-only");
  });

  it("allows read-only extraction goals", async () => {
    const result = await handleBrowseWeb({
      url: "https://linkedin.com/in/someone",
      extractionGoal: "Extract their recent posts and job title",
    });
    expect(result.success).toBe(true);
  });

  // ==============================================================
  // SSRF protection
  // ==============================================================

  it("blocks localhost URLs", async () => {
    const result = await handleBrowseWeb({
      url: "http://localhost:3000/admin",
      extractionGoal: "Get admin page",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("internal/private");
  });

  it("blocks cloud metadata endpoint", async () => {
    const result = await handleBrowseWeb({
      url: "http://169.254.169.254/latest/meta-data",
      extractionGoal: "Get metadata",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("internal/private");
  });

  it("blocks private RFC-1918 addresses", async () => {
    const result = await handleBrowseWeb({
      url: "http://192.168.1.1",
      extractionGoal: "Get router page",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("internal/private");
  });

  it("blocks .internal domains", async () => {
    const result = await handleBrowseWeb({
      url: "https://grafana.internal/d/api-latency",
      extractionGoal: "Get dashboard",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("internal/private");
  });

  it("blocks domains that resolve to private IPs (DNS rebinding)", async () => {
    mockLookup.mockResolvedValueOnce({ address: "127.0.0.1", family: 4 });
    const result = await handleBrowseWeb({
      url: "https://evil-rebind.example.com",
      extractionGoal: "Get content",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("internal/private");
  });

  it("blocks domains that resolve to cloud metadata IP", async () => {
    mockLookup.mockResolvedValueOnce({ address: "169.254.169.254", family: 4 });
    const result = await handleBrowseWeb({
      url: "https://metadata-proxy.example.com",
      extractionGoal: "Get content",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("internal/private");
  });

  // ==============================================================
  // URL normalization
  // ==============================================================

  it("adds https:// to bare URLs", async () => {
    await handleBrowseWeb({
      url: "linkedin.com/in/someone",
      extractionGoal: "Get job title",
    });
    expect(mockGoto).toHaveBeenCalledWith(
      "https://linkedin.com/in/someone",
      expect.any(Object),
    );
  });

  it("preserves existing https://", async () => {
    await handleBrowseWeb({
      url: "https://example.com/page",
      extractionGoal: "Get page content",
    });
    expect(mockGoto).toHaveBeenCalledWith(
      "https://example.com/page",
      expect.any(Object),
    );
  });

  // ==============================================================
  // Search query mode (AC-3)
  // ==============================================================

  it("builds Google search URL from query", async () => {
    await handleBrowseWeb({
      query: "site:linkedin.com Sarah Johnson CTO",
      extractionGoal: "Find LinkedIn profile",
    });
    expect(mockGoto).toHaveBeenCalledWith(
      expect.stringContaining("google.com/search?q="),
      expect.any(Object),
    );
  });

  // ==============================================================
  // Successful extraction (AC-2, AC-4)
  // ==============================================================

  it("returns structured extracted data", async () => {
    mockExtract.mockResolvedValue({ extraction: "CTO at Acme Corp, 5 recent posts about AI" });

    const result = await handleBrowseWeb({
      url: "https://linkedin.com/in/someone",
      extractionGoal: "Extract job title and recent activity",
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain("CTO at Acme Corp");
    expect(result.output).toContain("Source:");
  });

  // ==============================================================
  // Error handling (AC-9)
  // ==============================================================

  it("handles page timeout gracefully", async () => {
    mockGoto.mockRejectedValue(new Error("Navigation timeout of 30000ms exceeded"));

    const result = await handleBrowseWeb({
      url: "https://slow-site.com",
      extractionGoal: "Get content",
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("timed out");
  });

  it("handles page not found", async () => {
    mockGoto.mockRejectedValue(new Error("net::ERR_NAME_NOT_RESOLVED"));

    const result = await handleBrowseWeb({
      url: "https://nonexistent.example",
      extractionGoal: "Get content",
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });

  it("handles robots.txt / 403 block", async () => {
    mockGoto.mockRejectedValue(new Error("403 Forbidden"));

    const result = await handleBrowseWeb({
      url: "https://protected.example.com",
      extractionGoal: "Get content",
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("blocked");
  });

  // ==============================================================
  // Token budget (AC-8)
  // ==============================================================

  it("fails when token budget exceeded (hard enforcement)", async () => {
    const result = await handleBrowseWeb({
      url: "https://example.com",
      extractionGoal: "Extract everything",
      tokenBudget: 50, // budget < 150 tokens used by mock
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("Token budget exceeded");
    expect(result.output).toContain("Results discarded");
  });

  it("succeeds when within budget", async () => {
    const result = await handleBrowseWeb({
      url: "https://example.com",
      extractionGoal: "Extract summary",
      tokenBudget: 1000,
    });

    expect(result.success).toBe(true);
    expect(result.output).not.toContain("Token budget");
  });

  // ==============================================================
  // Activity logging (AC-7)
  // ==============================================================

  it("logs browse activity to activities table", async () => {
    await handleBrowseWeb({
      url: "https://example.com",
      extractionGoal: "Get page summary",
    });

    const activities = testDb
      .select()
      .from(schema.activities)
      .where(eq(schema.activities.action, "self_tool.browse_web"))
      .all();

    expect(activities.length).toBe(1);
    const meta = activities[0].metadata as Record<string, unknown>;
    expect(meta.url).toBe("https://example.com");
    expect(meta.success).toBe(true);
  });

  // ==============================================================
  // Stagehand lifecycle
  // ==============================================================

  it("always closes browser even on error", async () => {
    mockExtract.mockRejectedValue(new Error("extraction failed"));

    await handleBrowseWeb({
      url: "https://example.com",
      extractionGoal: "Get content",
    });

    expect(mockClose).toHaveBeenCalled();
  });
});
