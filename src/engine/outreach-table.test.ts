/**
 * Outreach Table Tests (Brief 149 Sub-brief C)
 *
 * Tests: HTML renderer, plain-text fallback, InteractiveTableBlock builder,
 * data gathering from interactions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../test-utils";
import * as schema from "../db/schema";
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

// Mock heartbeat (transitive dep)
vi.mock("./heartbeat", () => ({
  startProcessRun: vi.fn(async () => "mock-run-id"),
  fullHeartbeat: vi.fn(async () => ({ processRunId: "mock-run-id", stepsExecuted: 1, status: "completed", message: "mock" })),
}));

// Mock integration registry (transitive dep)
vi.mock("./integration-registry", () => ({
  getIntegration: vi.fn(() => undefined),
  getIntegrationRegistry: vi.fn(),
  clearRegistryCache: vi.fn(),
}));

import {
  renderOutreachTableHtml,
  renderOutreachTablePlainText,
  buildOutreachTableBlock,
  gatherOutreachBatchSummary,
} from "./outreach-table";
import type { OutreachBatchSummary } from "./outreach-table";

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
// Test Data Helpers
// ============================================================

function makeSummary(overrides: Partial<OutreachBatchSummary> = {}): OutreachBatchSummary {
  return {
    entries: [
      {
        personName: "Sarah Chen",
        company: "Acme Corp",
        status: "interested",
        sentAt: new Date("2026-04-10"),
      },
      {
        personName: "James Park",
        company: "Beta Inc",
        status: "sent",
        sentAt: new Date("2026-04-11"),
      },
      {
        personName: "Maria Lopez",
        company: "Gamma LLC",
        status: "replied",
        sentAt: new Date("2026-04-12"),
        replySnippet: "Sounds interesting, let's chat next week",
      },
    ],
    totalSent: 3,
    totalReplied: 2,
    totalInterested: 1,
    totalOptedOut: 0,
    responseRate: 0.67,
    ...overrides,
  };
}

// ============================================================
// renderOutreachTableHtml
// ============================================================

describe("renderOutreachTableHtml", () => {
  it("renders an inline-styled HTML table with status pills", () => {
    const summary = makeSummary();
    const html = renderOutreachTableHtml(summary);

    // Table structure
    expect(html).toContain("<table");
    expect(html).toContain("<thead>");
    expect(html).toContain("<tbody>");
    expect(html).toContain("</table>");

    // Column headers
    expect(html).toContain("Name");
    expect(html).toContain("Company");
    expect(html).toContain("Status");
    expect(html).toContain("Date");

    // Person data
    expect(html).toContain("Sarah Chen");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("James Park");
    expect(html).toContain("Beta Inc");

    // Status pills with correct colours
    expect(html).toContain("Interested");
    expect(html).toContain("#dcfce7"); // green bg for interested
    expect(html).toContain("Sent");
    expect(html).toContain("#f3f4f6"); // grey bg for sent

    // Inline styles — no external CSS
    expect(html).toContain("style=");
    expect(html).not.toContain("<link");
    expect(html).not.toContain("<style>");

    // Max-width constraint
    expect(html).toContain("max-width: 560px");

    // Metrics line
    expect(html).toContain("3 sent");
    expect(html).toContain("67% response rate");
  });

  it("alternates row backgrounds", () => {
    const summary = makeSummary();
    const html = renderOutreachTableHtml(summary);

    expect(html).toContain("#ffffff");
    expect(html).toContain("#f9f9f9");
  });

  it("returns empty string for empty entries", () => {
    const summary = makeSummary({ entries: [] });
    const html = renderOutreachTableHtml(summary);
    expect(html).toBe("");
  });

  it("escapes HTML in person names", () => {
    const summary = makeSummary({
      entries: [{
        personName: "<script>alert('xss')</script>",
        company: "Evil & Co",
        status: "sent",
        sentAt: new Date("2026-04-10"),
      }],
    });
    const html = renderOutreachTableHtml(summary);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Evil &amp; Co");
  });
});

// ============================================================
// renderOutreachTablePlainText
// ============================================================

describe("renderOutreachTablePlainText", () => {
  it("renders a plain text list", () => {
    const summary = makeSummary();
    const text = renderOutreachTablePlainText(summary);

    expect(text).toContain("Outreach Results:");
    expect(text).toContain("Sarah Chen (Acme Corp) — Interested");
    expect(text).toContain("James Park (Beta Inc) — Sent");
    expect(text).toContain("3 sent");
    expect(text).toContain("67% response rate");
  });

  it("returns empty string for empty entries", () => {
    const text = renderOutreachTablePlainText(makeSummary({ entries: [] }));
    expect(text).toBe("");
  });
});

// ============================================================
// buildOutreachTableBlock
// ============================================================

describe("buildOutreachTableBlock", () => {
  it("builds an InteractiveTableBlock with correct structure", () => {
    const summary = makeSummary();
    const block = buildOutreachTableBlock(summary);

    expect(block.type).toBe("interactive_table");
    expect(block.title).toBe("Outreach Results");
    expect(block.columns).toHaveLength(4);
    expect(block.columns.map((c) => c.key)).toEqual(["name", "company", "status", "date"]);
    expect(block.rows).toHaveLength(3);
    expect(block.selectable).toBe(true);
    expect(block.batchActions).toHaveLength(2);
  });

  it("maps statuses to row status correctly", () => {
    const summary = makeSummary();
    const block = buildOutreachTableBlock(summary);

    // interested -> approved
    expect(block.rows[0].status).toBe("approved");
    // sent -> pending
    expect(block.rows[1].status).toBe("pending");
    // replied -> pending
    expect(block.rows[2].status).toBe("pending");
  });

  it("includes per-row actions", () => {
    const summary = makeSummary();
    const block = buildOutreachTableBlock(summary);

    const row = block.rows[0];
    expect(row.actions).toHaveLength(2);
    expect(row.actions![0].id).toBe("view-thread");
    expect(row.actions![1].id).toBe("skip-followup");
  });

  it("includes summary metrics", () => {
    const summary = makeSummary();
    const block = buildOutreachTableBlock(summary);

    expect(block.summary).toContain("3 sent");
    expect(block.summary).toContain("67% response rate");
  });
});

// ============================================================
// gatherOutreachBatchSummary
// ============================================================

describe("gatherOutreachBatchSummary", () => {
  it("gathers outreach data from interactions", async () => {
    const userId = randomUUID();
    const personId = randomUUID();

    // Create person
    await testDb.insert(schema.people).values({
      id: personId,
      userId,
      name: "Test Contact",
      email: "contact@example.com",
      organization: "Test Corp",
      source: "manual",
    });

    // Create outreach interaction
    await testDb.insert(schema.interactions).values({
      personId,
      userId,
      type: "outreach_sent",
      channel: "email",
      mode: "selling",
      summary: "Initial outreach",
    });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const summary = await gatherOutreachBatchSummary(userId, since);

    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0].personName).toBe("Test Contact");
    expect(summary.entries[0].company).toBe("Test Corp");
    expect(summary.entries[0].status).toBe("sent");
    expect(summary.totalSent).toBe(1);
  });

  it("returns empty summary when no outreach interactions", async () => {
    const userId = randomUUID();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const summary = await gatherOutreachBatchSummary(userId, since);

    expect(summary.entries).toHaveLength(0);
    expect(summary.totalSent).toBe(0);
    expect(summary.responseRate).toBe(0);
  });

  it("maps positive reply to interested status", async () => {
    const userId = randomUUID();
    const personId = randomUUID();

    await testDb.insert(schema.people).values({
      id: personId,
      userId,
      name: "Positive Contact",
      email: "positive@example.com",
      organization: "Good Corp",
      source: "manual",
    });

    // Create outreach + positive reply
    await testDb.insert(schema.interactions).values([
      {
        personId,
        userId,
        type: "outreach_sent",
        channel: "email",
        mode: "selling",
        summary: "Initial outreach",
      },
      {
        personId,
        userId,
        type: "reply_received",
        channel: "email",
        mode: "selling",
        outcome: "positive",
        summary: "Sounds great, let's chat",
      },
    ]);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const summary = await gatherOutreachBatchSummary(userId, since);

    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0].status).toBe("interested");
    expect(summary.totalInterested).toBe(1);
  });

  it("groups by person showing most recent status", async () => {
    const userId = randomUUID();
    const personId = randomUUID();

    await testDb.insert(schema.people).values({
      id: personId,
      userId,
      name: "Multi Contact",
      email: "multi@example.com",
      source: "manual",
    });

    // Create multiple interactions for same person
    await testDb.insert(schema.interactions).values([
      {
        personId,
        userId,
        type: "outreach_sent",
        channel: "email",
        mode: "selling",
        summary: "First outreach",
      },
      {
        personId,
        userId,
        type: "reply_received",
        channel: "email",
        mode: "selling",
        summary: "Got it, thanks",
      },
    ]);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const summary = await gatherOutreachBatchSummary(userId, since);

    // Should be grouped into 1 entry (same person)
    expect(summary.entries).toHaveLength(1);
    // Most recent status should win
    expect(summary.entries[0].status).toBe("replied");
  });
});
