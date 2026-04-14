/**
 * POST /api/v1/voice/tool — ElevenLabs server tool webhook (Brief 142b)
 *
 * Single endpoint handling server tools for the ElevenLabs voice agent.
 * Each tool call includes a `tool` field identifying which tool to execute.
 *
 * Tools:
 * - update_learned: Records what the agent learned about the visitor
 * - fetch_url: Fetches a URL and returns a summary
 *
 * Note: get_context is now a client tool (handled in voice-call.tsx, not here).
 * Transcript persistence uses dedicated /api/v1/voice/transcript endpoint (Brief 150).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Load env from root .env
    try {
      const { config } = await import("dotenv");
      const path = await import("path");
      config({ path: path.resolve(process.cwd(), "../../.env") });
    } catch { /* env vars may be set via platform */ }

    const body = await request.json();
    const { tool, sessionId, voiceToken } = body as {
      tool: string;
      sessionId?: string;
      voiceToken?: string;
    };

    console.log(`[voice/tool] ${tool} called (session: ${sessionId?.slice(0, 8)}...)`);

    if (!sessionId || !voiceToken) {
      return NextResponse.json({ error: "Missing sessionId or voiceToken" }, { status: 400 });
    }

    const { loadSessionForVoice, buildVoiceFallbackGuidance } = await import(
      "../../../../../../../src/engine/network-chat"
    );

    const session = await loadSessionForVoice(sessionId, voiceToken);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    switch (tool) {
      case "update_learned": {
        // Tool sends flat fields (name, business, target, etc.) directly on body
        const { name, business, target, location, problem, role, industry, channel } = body as Record<string, string | undefined>;
        const learned: Record<string, string | null> = {};
        if (name) learned.name = name;
        if (business) learned.business = business;
        if (target) learned.target = target;
        if (location) learned.location = location;
        if (problem) learned.problem = problem;
        if (role) learned.role = role;
        if (industry) learned.industry = industry;
        if (channel) learned.channel = channel;
        return handleUpdateLearned(session, buildVoiceFallbackGuidance, Object.keys(learned).length > 0 ? learned : null);
      }

      case "fetch_url": {
        const { url } = body as { url?: string };
        return handleFetchUrl(session, buildVoiceFallbackGuidance, url);
      }

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[voice/tool] Error:", (err as Error).message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ============================================================
// Tool Handlers
// ============================================================

interface SessionLike {
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
  learned: Record<string, string | null> | null;
  messageCount: number;
  requestEmailFlagged: boolean;
}

type FallbackGuidanceFn = (learned: Record<string, string | null> | null) => string;

async function handleUpdateLearned(
  session: SessionLike,
  fallbackGuidance: FallbackGuidanceFn,
  learned?: Record<string, string | null> | null,
) {
  if (!learned || Object.keys(learned).length === 0) {
    return NextResponse.json({ success: true, stage: "gathering" });
  }

  // Import DB access
  const { db, schema } = await import("../../../../../../../src/db");
  const { eq } = await import("drizzle-orm");

  // Merge with existing learned context
  const merged = { ...(session.learned || {}), ...learned };

  await db
    .update(schema.chatSessions)
    .set({ learned: merged, updatedAt: new Date() })
    .where(eq(schema.chatSessions.sessionId, session.sessionId));

  console.log(`[voice/tool] update_learned: ${JSON.stringify(merged)}`);

  return NextResponse.json({
    success: true,
    stage: "gathering",
    next_instruction: fallbackGuidance(merged),
  });
}

async function handleFetchUrl(session: SessionLike, fallbackGuidance: FallbackGuidanceFn, url?: string) {
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  console.log(`[voice/tool] fetch_url: ${url}`);

  const { fetchUrlContent } = await import("../../../../../../../src/engine/web-fetch");

  const result = await fetchUrlContent(url);
  if (!result.content) {
    return NextResponse.json({
      summary: `I couldn't load ${url} — it might be down or blocking automated access.`,
    });
  }

  // Also write enrichment to session for the chat UI to display
  const { db, schema } = await import("../../../../../../../src/db");
  const { eq } = await import("drizzle-orm");

  const messages = [...session.messages, {
    role: "assistant",
    content: `I've looked at ${url} — here's what I found:\n\n${result.content.slice(0, 2000)}`,
  }];

  await db
    .update(schema.chatSessions)
    .set({ messages, updatedAt: new Date() })
    .where(eq(schema.chatSessions.sessionId, session.sessionId));

  // Return summary + process guidance for the voice agent
  const summary = result.content.slice(0, 1500);
  return NextResponse.json({
    content: summary,
    summary: `Here's the content from ${url}: ${summary.slice(0, 500)}`,
    next_instruction: fallbackGuidance(session.learned),
  });
}

