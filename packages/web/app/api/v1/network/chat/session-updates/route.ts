/**
 * GET /api/v1/network/chat/session-updates — Poll for live session state.
 * POST /api/v1/network/chat/session-updates — Add text context during voice call.
 *
 * Used by the frontend during an active voice call to show live conversation
 * updates and learned-context changes as the voice agent progresses.
 *
 * Auth: sessionId + voiceToken (same as voice endpoint).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Load env from root .env
    try {
      const { config } = await import("dotenv");
      const path = await import("path");
      config({ path: path.resolve(process.cwd(), "../../.env") });
    } catch { /* env vars may be set via platform */ }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const voiceToken = searchParams.get("voiceToken");

    if (!sessionId || !voiceToken) {
      return NextResponse.json({ error: "Missing sessionId or voiceToken" }, { status: 400 });
    }

    const { loadSessionForVoice } = await import("../../../../../../../../src/engine/network-chat");

    const session = await loadSessionForVoice(sessionId, voiceToken);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Filter to only user + assistant messages (skip internal markers).
    // Brief 180: guidance delivery moved to voice-call.tsx's push path (via
    // /voice/guidance + voiceDedup). This endpoint now only feeds the
    // learned-context UI card; stage/guidance are no longer computed here.
    const messages = session.messages
      .filter((m) => !m.content.startsWith("["))
      .map((m) => ({ role: m.role, text: m.content }));

    return NextResponse.json({
      messages,
      learned: session.learned,
      messageCount: session.messageCount,
    });
  } catch (err) {
    console.error("[session-updates] Error:", (err as Error).message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST — Add text context to an active voice session.
 * The message is appended to the session so the voice agent sees it on the next turn.
 * Tagged with [TEXT_CONTEXT] so the voice agent knows it came from the text input.
 */
export async function POST(request: Request) {
  try {
    try {
      const { config } = await import("dotenv");
      const path = await import("path");
      config({ path: path.resolve(process.cwd(), "../../.env") });
    } catch { /* env vars may be set via platform */ }

    const body = await request.json();
    const { sessionId, voiceToken, message, role } = body as {
      sessionId?: string;
      voiceToken?: string;
      message?: string;
      role?: "user" | "assistant";
    };

    if (!sessionId || !voiceToken || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { loadSessionForVoice } = await import(
      "../../../../../../../../src/engine/network-chat"
    );

    const session = await loadSessionForVoice(sessionId, voiceToken);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Save message to session with correct role
    const { db, schema } = await import("../../../../../../../../src/db");
    const { eq } = await import("drizzle-orm");
    session.messages.push({ role: role || "user", content: message });
    session.messageCount += 1;
    await db
      .update(schema.chatSessions)
      .set({
        messages: session.messages,
        messageCount: session.messageCount,
        updatedAt: new Date(),
      })
      .where(eq(schema.chatSessions.sessionId, sessionId));

    // Invalidate voice dedup cache: transcript just advanced (Brief 180 AC 12).
    // The next /voice/guidance call will recompute against fresh state.
    const { voiceDedup } = await import(
      "../../../../../../../../src/engine/voice-dedup"
    );
    voiceDedup.invalidate(sessionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[session-updates] POST error:", (err as Error).message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
