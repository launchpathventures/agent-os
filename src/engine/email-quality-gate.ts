/**
 * Email Quality Gate — Haiku-based validation for LLM-generated emails.
 *
 * Every LLM-composed email from Alex passes through this gate before sending.
 * Validates: sounds like Alex, no filler/sycophancy, specific not generic,
 * factually grounded in context. Returns the original email if it passes —
 * does not rewrite emails that are already good.
 *
 * Uses Haiku (purpose: "classification") for speed — must add <500ms latency.
 *
 * Ghost mode emails are exempt (they're the user's voice, not Alex's).
 *
 * Design decision: This is a lightweight validation layer, not an architectural
 * primitive. It does not warrant an ADR. If the pattern grows (multiple gate
 * types, configurable rules, chained gates), revisit.
 *
 * Provenance: validateAndCleanResponse() pattern in network-chat.ts (Brief 144).
 */

import { createCompletion, extractText } from "./llm";

// ============================================================
// Types
// ============================================================

export interface QualityGateResult {
  /** Whether the email passed all checks */
  passed: boolean;
  /** The email body to send (original if passed, cleaned if fixable issues found) */
  body: string;
  /** Which checks failed (empty if passed) */
  failedChecks: string[];
  /** Latency in milliseconds */
  latencyMs: number;
  /** True when the body was rewritten by the gate (not just passed through) */
  wasRewritten: boolean;
}

/** Optional context for the quality gate caller */
export interface QualityGateOptions {
  recipientName?: string;
  conversationSummary?: string;
  /** Caller identifier for audit trail (e.g., "sendActionEmail", "composeStatusEmail") */
  callerContext?: string;
  /**
   * Database handle for durable logging. When provided, gate results are
   * logged to the activities table. Accepts any Drizzle db instance.
   * When omitted, logging is skipped (useful in tests or db-free contexts).
   */
  db?: { insert: (table: unknown) => { values: (v: unknown) => unknown } };
  /** Schema reference for the activities table */
  schema?: { activities: unknown };
}

// ============================================================
// Quality Gate
// ============================================================

/**
 * Validate an LLM-generated email against Alex's voice spec.
 *
 * Checks:
 * (a) No sycophantic filler ("great question", "absolutely", "I'd love to help")
 * (b) No corporate jargon
 * (c) Specific to the user's situation (not generic)
 * (d) Substance — makes a point, shares information, or asks a real question
 *
 * Returns the original email if it passes. If issues are fixable,
 * returns a cleaned version. If unfixable, returns original with failed checks noted.
 */
export async function validateEmailVoice(
  emailBody: string,
  context?: QualityGateOptions,
): Promise<QualityGateResult> {
  const start = Date.now();

  // Skip validation for very short emails (< 30 chars) — likely fallback templates
  if (emailBody.length < 30) {
    return {
      passed: true,
      body: emailBody,
      failedChecks: [],
      latencyMs: Date.now() - start,
      wasRewritten: false,
    };
  }

  try {
    const response = await createCompletion({
      system: [
        "You are a quality checker for emails written by Alex, a senior advisor at Ditto.",
        "Alex is Australian, warm, direct, with dry humour. He sounds like a smart mate — not a corporate robot.",
        "",
        "Check the email for these issues:",
        "1. SYCOPHANCY: phrases like 'great question', 'absolutely', 'I'd love to help', 'good starting point', 'thanks for sharing'",
        "2. CORPORATE_JARGON: 'leveraging', 'synergies', 'circle back', 'touch base', 'moving forward', 'in terms of'",
        "3. GENERIC: could be sent to anyone — no names, no specifics, no reference to their situation",
        "4. NO_SUBSTANCE: doesn't make a point, share information, or ask a real question — just filler",
        "",
        "Respond with a JSON object (no markdown, no code fences):",
        '{"passed": true/false, "issues": ["SYCOPHANCY", ...], "cleaned": "...or empty if passed"}',
        "",
        "Rules:",
        "- If the email passes all checks, set passed=true and cleaned=empty string",
        "- If issues are found, set passed=false and provide a cleaned version with ONLY the problematic phrases fixed",
        "- Preserve the email's structure, meaning, and tone — just remove/replace the flagged phrases",
        "- Do NOT rewrite emails that are already good",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            "Check this email:",
            "",
            emailBody,
            context?.recipientName ? `\nRecipient: ${context.recipientName}` : "",
            context?.conversationSummary ? `\nConversation context: ${context.conversationSummary}` : "",
          ].filter(Boolean).join("\n"),
        },
      ],
      maxTokens: 500,
      purpose: "classification", // Routes to Haiku for speed
    });

    const text = extractText(response.content).trim();
    const latencyMs = Date.now() - start;

    // Parse the JSON response
    let result: { passed: boolean; issues: string[]; cleaned: string };
    try {
      // Strip markdown code fences anywhere in the response and extract JSON
      let jsonStr = text;
      const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fencedMatch) {
        jsonStr = fencedMatch[1].trim();
      }
      // Also try extracting first {...} block if no fences found
      if (!fencedMatch && !jsonStr.startsWith("{")) {
        const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (braceMatch) jsonStr = braceMatch[0];
      }
      result = JSON.parse(jsonStr);
    } catch {
      // JSON parse failed — treat as pass (don't block email delivery)
      console.warn("[quality-gate] Failed to parse validator response, treating as pass");
      await logGateResult(emailBody, true, [], latencyMs, false, context);
      return { passed: true, body: emailBody, failedChecks: [], latencyMs, wasRewritten: false };
    }

    const failedChecks = Array.isArray(result.issues) ? result.issues.filter((i) => typeof i === "string") : [];

    if (result.passed || failedChecks.length === 0) {
      await logGateResult(emailBody, true, [], latencyMs, false, context);
      return { passed: true, body: emailBody, failedChecks: [], latencyMs, wasRewritten: false };
    }

    // Return cleaned version if provided, otherwise return original with flags
    const cleanedBody = typeof result.cleaned === "string" && result.cleaned.trim().length > 0
      ? result.cleaned.trim()
      : emailBody;

    const wasRewritten = cleanedBody !== emailBody;

    // FLAG-3 fix: explicit warning when Haiku rewrites a Sonnet-composed email
    if (wasRewritten) {
      console.warn(
        `[quality-gate] Email REWRITTEN by gate (${failedChecks.join(", ")}). ` +
        `Caller: ${context?.callerContext || "unknown"}. ` +
        `Original ${emailBody.length} chars → cleaned ${cleanedBody.length} chars. ` +
        `Review if frequent — may indicate writing prompt needs tightening.`,
      );
    }

    // Log result durably to activities table
    await logGateResult(emailBody, false, failedChecks, latencyMs, wasRewritten, context);

    return {
      passed: false,
      body: cleanedBody,
      failedChecks,
      latencyMs,
      wasRewritten,
    };
  } catch (err) {
    // Quality gate failure is non-fatal — never block email delivery
    const latencyMs = Date.now() - start;
    console.error("[quality-gate] Validation failed, passing through:", (err as Error).message);
    await logGateResult(emailBody, true, ["GATE_ERROR"], latencyMs, false, context);
    return { passed: true, body: emailBody, failedChecks: [], latencyMs, wasRewritten: false };
  }
}

// ============================================================
// Durable Logging (AC20) — FLAG-1 fix: DB injected, not imported
// ============================================================

/**
 * Log quality gate results to the activities table for the learning layer.
 * Fire-and-forget — logging failure never blocks email delivery.
 *
 * DB is injected via context.db + context.schema. When not provided,
 * falls back to importing from ../db (backward compat for callers that
 * don't pass db). This keeps the gate testable without DB mocking.
 */
async function logGateResult(
  emailBody: string,
  passed: boolean,
  failedChecks: string[],
  latencyMs: number,
  wasRewritten: boolean,
  context?: QualityGateOptions,
): Promise<void> {
  try {
    // Use injected db if available, otherwise fall back to import
    let dbHandle: { insert: (table: unknown) => { values: (v: unknown) => unknown } };
    let activitiesTable: unknown;

    if (context?.db && context?.schema) {
      dbHandle = context.db;
      activitiesTable = (context.schema as Record<string, unknown>).activities;
    } else {
      const dbModule = await import("../db");
      dbHandle = dbModule.db as unknown as typeof dbHandle;
      activitiesTable = dbModule.schema.activities;
    }

    await dbHandle.insert(activitiesTable).values({
      action: "email_quality_gate",
      description: passed
        ? `Email passed quality gate (${latencyMs}ms)`
        : `Email ${wasRewritten ? "rewritten" : "flagged"} by quality gate: ${failedChecks.join(", ")} (${latencyMs}ms)`,
      actorType: "system",
      actorId: "quality-gate",
      entityType: "email",
      metadata: {
        passed,
        failedChecks,
        latencyMs,
        wasRewritten,
        callerContext: context?.callerContext || "unknown",
        // Redact email addresses from preview to minimize PII in activity logs
        emailPreview: emailBody.slice(0, 200).replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]"),
      },
    });
  } catch {
    // Logging failure is non-fatal
    console.warn("[quality-gate] Failed to log gate result to activities");
  }
}
