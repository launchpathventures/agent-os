/**
 * POST /api/v1/voice/transcript — Persist voice transcript turns (Brief 150 AC 1-2)
 *
 * Called by the frontend with batched voice conversation turns.
 * Appends turns to chatSessions.messages with [voice] prefix.
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
    const { sessionId, voiceToken, turns } = body as {
      sessionId?: string;
      voiceToken?: string;
      turns?: Array<{ role: "user" | "alex"; text: string }>;
    };

    if (!sessionId || !voiceToken) {
      return NextResponse.json({ error: "Missing sessionId or voiceToken" }, { status: 400 });
    }

    if (!turns || turns.length === 0) {
      return NextResponse.json({ success: true, saved: 0 });
    }

    // Input validation: limit turns per request and text length
    const MAX_TURNS = 50;
    const MAX_TEXT_LENGTH = 5000;
    const sanitized = turns.slice(0, MAX_TURNS).map((t) => ({
      role: t.role,
      text: typeof t.text === "string" ? t.text.slice(0, MAX_TEXT_LENGTH) : "",
    })).filter((t) => t.text.length > 0);

    if (sanitized.length === 0) {
      return NextResponse.json({ success: true, saved: 0 });
    }

    const { saveVoiceTranscript } = await import(
      "../../../../../../../src/engine/network-chat"
    );

    const success = await saveVoiceTranscript(sessionId, voiceToken, sanitized);
    if (!success) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, saved: sanitized.length });
  } catch (err) {
    console.error("[voice/transcript] Error:", (err as Error).message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
