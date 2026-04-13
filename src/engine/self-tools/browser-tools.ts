/**
 * Ditto — Self Tools: Browser (Browse Web)
 *
 * READ-only browser skill using Stagehand. Navigates to URLs or performs
 * web searches, then extracts structured data via AI-driven extraction.
 *
 * Constraints:
 * - No WRITE operations (form submission, message sending, account creation)
 * - Headless and stateless — no persistent cookies or login state
 * - Token budget hard-enforced per invocation (results discarded if exceeded)
 * - Activity logged per ADR-005
 *
 * Provenance: Brief 134, Stagehand (@browserbasehq/stagehand), Adopt level.
 */

import { lookup } from "dns/promises";
import { db, schema } from "../../db";
import type { DelegationResult } from "../self-delegation";

// ============================================================
// Constants
// ============================================================

/** Default token budget for Stagehand AI calls per invocation */
const DEFAULT_TOKEN_BUDGET = 500;

/** Timeout for browser session (ms) */
const SESSION_TIMEOUT_MS = 30_000;

/** Default model for Stagehand extraction (override via STAGEHAND_MODEL env) */
const DEFAULT_STAGEHAND_MODEL = "anthropic/claude-sonnet-4-5-20250929";

/**
 * SSRF guard: block navigation to private/internal network addresses.
 * Prevents the browser from accessing localhost, link-local, cloud metadata,
 * or RFC-1918 private ranges.
 */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,         // link-local / cloud metadata
  /^0\./,
  /^\[::1\]/,            // IPv6 loopback
  /^metadata\.google\./i,
  /\.internal$/i,
  /\.local$/i,
];

/** Keywords that suggest WRITE intent in extraction goals */
const WRITE_INTENT_PATTERNS = [
  /\bsubmit\b/i,
  /\bsend\b/i,
  /\bpost\b/i,
  /\bclick\s+(send|submit|post|publish|create|sign\s*up|register|log\s*in)\b/i,
  /\bfill\s+(out|in)\b/i,
  /\bcreate\s+(account|profile)\b/i,
  /\bsign\s*(up|in)\b/i,
  /\blog\s*in\b/i,
  /\bregister\b/i,
  /\bpublish\b/i,
  /\bdelete\b/i,
  /\bremove\b/i,
  /\bupdate\b/i,
  /\bedit\b/i,
  /\bmodify\b/i,
  /\bupload\b/i,
  /\bcompose\b/i,
  /\bwrite\s+a\b/i,
  /\breply\b/i,
  /\bcomment\b/i,
  /\blike\b/i,
  /\bfollow\b/i,
  /\bconnect\b/i,
  /\bmessage\b/i,
  /\bdm\b/i,
];

// ============================================================
// Input / Output types
// ============================================================

export interface BrowseWebInput {
  url?: string;
  query?: string;
  extractionGoal: string;
  tokenBudget?: number;
}

interface BrowseResult {
  success: boolean;
  data?: string;
  error?: string;
  tokensUsed?: number;
  sourceUrl?: string;
}

// ============================================================
// WRITE intent detection
// ============================================================

function detectWriteIntent(extractionGoal: string): boolean {
  return WRITE_INTENT_PATTERNS.some((pattern) => pattern.test(extractionGoal));
}

// ============================================================
// URL validation
// ============================================================

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

/** Check resolved IP against private/internal ranges (mirrors web-fetch.ts). */
const BLOCKED_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./, /^169\.254\./, /^0\./,
  /^::1$/, /^fc00:/i, /^fe80:/i,
];

function isBlockedIp(ip: string): boolean {
  return BLOCKED_IP_RANGES.some((re) => re.test(ip));
}

async function normalizeUrl(url: string): Promise<string> {
  let normalized = url.trim();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized;
  }
  // Validate URL structure
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  // SSRF guard: block private/internal hostnames
  if (isBlockedHost(parsed.hostname)) {
    throw new Error(`Blocked URL: navigation to internal/private addresses is not allowed (${parsed.hostname})`);
  }
  // SSRF guard: resolve DNS and check the actual IP (prevents DNS rebinding attacks)
  try {
    const { address } = await lookup(parsed.hostname);
    if (isBlockedIp(address)) {
      throw new Error(`Blocked URL: resolved to internal/private IP (${parsed.hostname})`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Blocked URL:")) throw err;
    throw new Error(`Could not resolve ${parsed.hostname} — the domain may not exist.`);
  }
  return normalized;
}

function buildSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query.trim());
  return `https://www.google.com/search?q=${encoded}`;
}

// ============================================================
// Core browser execution
// ============================================================

async function executeBrowse(input: BrowseWebInput): Promise<BrowseResult> {
  // Determine target URL
  let targetUrl: string;
  try {
    if (input.url) {
      targetUrl = await normalizeUrl(input.url);
    } else if (input.query) {
      targetUrl = buildSearchUrl(input.query);
    } else {
      return { success: false, error: "Either url or query is required." };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }

  // Dynamic import to avoid loading Stagehand at module init
  const { Stagehand } = await import("@browserbasehq/stagehand");

  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 0,
    localBrowserLaunchOptions: {
      headless: true,
    },
    model: {
      modelName: process.env.STAGEHAND_MODEL ?? DEFAULT_STAGEHAND_MODEL,
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  });

  try {
    await stagehand.init();

    // Navigate to target
    const pages = stagehand.context.pages();
    const page = pages[0];
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeoutMs: SESSION_TIMEOUT_MS });

    // Extract data using Stagehand's AI extraction
    const result = await stagehand.extract(input.extractionGoal);

    // Get metrics for token tracking
    const metrics = await stagehand.metrics;
    const tokensUsed = (metrics.totalPromptTokens ?? 0) +
      (metrics.totalCompletionTokens ?? 0);

    const extractedText = typeof result === "string"
      ? result
      : (result as { extraction?: string }).extraction ?? JSON.stringify(result, null, 2);

    return {
      success: true,
      data: extractedText,
      tokensUsed,
      sourceUrl: targetUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Classify error
    if (message.includes("timeout") || message.includes("Timeout")) {
      return { success: false, error: `Page timed out: ${targetUrl}`, sourceUrl: targetUrl };
    }
    if (message.includes("net::ERR_NAME_NOT_RESOLVED") || message.includes("404")) {
      return { success: false, error: `Page not found: ${targetUrl}`, sourceUrl: targetUrl };
    }
    if (message.includes("robots") || message.includes("403")) {
      return { success: false, error: `Access blocked (possibly robots.txt): ${targetUrl}`, sourceUrl: targetUrl };
    }

    return { success: false, error: `Browser error: ${message}`, sourceUrl: targetUrl };
  } finally {
    try {
      await stagehand.close();
    } catch {
      // Swallow close errors
    }
  }
}

// ============================================================
// Activity logging (ADR-005)
// ============================================================

async function logBrowseActivity(
  input: BrowseWebInput,
  result: BrowseResult,
): Promise<void> {
  try {
    await db.insert(schema.activities).values({
      action: "self_tool.browse_web",
      actorType: "system",
      entityType: "system",
      entityId: "browse_web",
      metadata: {
        url: input.url ?? null,
        query: input.query ?? null,
        extractionGoal: input.extractionGoal,
        success: result.success,
        tokensUsed: result.tokensUsed ?? 0,
        sourceUrl: result.sourceUrl ?? null,
        error: result.error ?? null,
      },
    });
  } catch (err) {
    console.warn("browse_web: activity logging failed:", err instanceof Error ? err.message : err);
  }
}

// ============================================================
// Handler (self-tool entry point)
// ============================================================

export async function handleBrowseWeb(
  input: BrowseWebInput,
): Promise<DelegationResult> {
  // Validate: must have url or query
  if (!input.url && !input.query) {
    return {
      toolName: "browse_web",
      success: false,
      output: "Either a URL or search query is required.",
    };
  }

  if (!input.extractionGoal || input.extractionGoal.trim().length === 0) {
    return {
      toolName: "browse_web",
      success: false,
      output: "An extraction goal is required — what should I look for on this page?",
    };
  }

  // AC-5: Refuse WRITE operations
  if (detectWriteIntent(input.extractionGoal)) {
    return {
      toolName: "browse_web",
      success: false,
      output: "Browse web is READ-only. I can't submit forms, send messages, create accounts, or perform any write actions through the browser. I can only research and extract information.",
    };
  }

  // Execute browser research
  const result = await executeBrowse(input);

  // Log activity (ADR-005)
  await logBrowseActivity(input, result);

  if (!result.success) {
    return {
      toolName: "browse_web",
      success: false,
      output: result.error ?? "Browser research failed.",
      metadata: {
        sourceUrl: result.sourceUrl,
        tokensUsed: result.tokensUsed ?? 0,
      },
    };
  }

  // Enforce token budget — hard limit, not advisory
  const budget = input.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  if (result.tokensUsed && result.tokensUsed > budget) {
    return {
      toolName: "browse_web",
      success: false,
      output: `Token budget exceeded: used ${result.tokensUsed} tokens (budget: ${budget}). Results discarded. Increase tokenBudget or simplify the extraction goal.`,
      metadata: {
        sourceUrl: result.sourceUrl,
        tokensUsed: result.tokensUsed,
        budgetExceeded: true,
      },
    };
  }

  return {
    toolName: "browse_web",
    success: true,
    output: `**Source:** ${result.sourceUrl}\n\n${result.data}`,
    metadata: {
      sourceUrl: result.sourceUrl,
      tokensUsed: result.tokensUsed ?? 0,
    },
  };
}
