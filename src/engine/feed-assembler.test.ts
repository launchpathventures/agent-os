/**
 * Tests for feed assembler GTM GATE enrichment (Brief 141).
 *
 * Tests: structured experiment markdown formatting, track grouping,
 * non-GTM processes unaffected.
 *
 * Provenance: Brief 141 AC1-AC3, AC16
 */

import { describe, it, expect } from "vitest";
import { formatExperimentSection } from "./feed-assembler";

describe("formatExperimentSection", () => {
  // ── AC1: Structured markdown with all fields ──────────────

  it("formats structured experiment with all fields", () => {
    const draft = {
      hook: "Are you still managing your CRM manually?",
      target: "Small business owners on LinkedIn",
      channel: "LinkedIn feed post",
      hypothesis: "Pain-naming posts get 3x engagement vs product posts",
      killCriteria: "Less than 5 engagements in 48 hours",
      successCriteria: "More than 20 engagements and 3 profile visits",
      confidence: 4,
      draft: "Every week I talk to founders who spend 2 hours a day copying data between spreadsheets...",
    };

    const result = formatExperimentSection("Credibility", draft);

    expect(result).toContain("## Credibility");
    expect(result).toContain("**Hook:** Are you still managing your CRM manually?");
    expect(result).toContain("**Target:** Small business owners on LinkedIn");
    expect(result).toContain("**Hypothesis:** Pain-naming posts get 3x engagement");
    expect(result).toContain("**Kill criteria:** Less than 5 engagements");
    expect(result).toContain("**Confidence:** 4/5");
    expect(result).toContain("### Draft");
    expect(result).toContain("Every week I talk to founders");
  });

  // ── AC2: Track grouping with markdown headers ────────────

  it("uses track name as H2 header", () => {
    const result = formatExperimentSection("Pain-naming", { hook: "test" });
    expect(result).toMatch(/^## Pain-naming/);
  });

  it("formats credibility track", () => {
    const result = formatExperimentSection("Credibility", { hook: "Why I built X" });
    expect(result).toContain("## Credibility");
  });

  it("formats outreach track", () => {
    const result = formatExperimentSection("Outreach", { hook: "Hey Sarah" });
    expect(result).toContain("## Outreach");
  });

  // ── String draft fallback ────────────────────────────────

  it("handles plain string draft", () => {
    const result = formatExperimentSection("Credibility", "This is a raw text draft...");

    expect(result).toContain("## Credibility");
    expect(result).toContain("This is a raw text draft...");
  });

  // ── Outreach with multiple recipients ────────────────────

  it("formats outreach with multiple recipients", () => {
    const draft = {
      hook: "Personalised outreach",
      target: "Founders with CRM pain",
      hypothesis: "Referencing their specific post increases reply rate",
      killCriteria: "0 replies from 5 messages",
      confidence: 3,
      recipients: [
        {
          to: "Sarah Chen",
          channel: "LinkedIn DM",
          hook: "Saw your post about spreadsheet fatigue",
          draft: "Hi Sarah, I noticed your post about...",
        },
        {
          to: "Mark Johnson",
          channel: "Email",
          hook: "Your talk at SaaStr",
          draft: "Hey Mark, loved your talk...",
        },
      ],
    };

    const result = formatExperimentSection("Outreach", draft);

    expect(result).toContain("## Outreach");
    expect(result).toContain("**To:** Sarah Chen");
    expect(result).toContain("**Channel:** LinkedIn DM");
    expect(result).toContain("**To:** Mark Johnson");
    expect(result).toContain("**Channel:** Email");
    expect(result).toContain("> Hi Sarah, I noticed");
    expect(result).toContain("> Hey Mark, loved your talk");
  });

  // ── Edge cases ───────────────────────────────────────────

  it("handles draft with only some fields", () => {
    const draft = {
      hook: "Quick hook",
      confidence: 2,
    };

    const result = formatExperimentSection("Pain-naming", draft);

    expect(result).toContain("## Pain-naming");
    expect(result).toContain("**Hook:** Quick hook");
    expect(result).toContain("**Confidence:** 2/5");
    expect(result).not.toContain("**Target:**");
    expect(result).not.toContain("### Draft");
  });

  it("handles content field as draft text", () => {
    const draft = {
      hook: "Test",
      content: "Full content here",
    };

    const result = formatExperimentSection("Credibility", draft);
    expect(result).toContain("### Draft");
    expect(result).toContain("Full content here");
  });

  it("handles empty/null draft gracefully", () => {
    const result = formatExperimentSection("Credibility", null);
    expect(result).toContain("## Credibility");
  });

  it("handles empty object draft", () => {
    const result = formatExperimentSection("Credibility", {});
    expect(result).toContain("## Credibility");
  });
});
