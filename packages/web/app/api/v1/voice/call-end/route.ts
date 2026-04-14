/**
 * POST /api/v1/voice/call-end — Handle end of a voice call (Brief 142b, Brief 150 AC 7-8)
 *
 * Called by the frontend when the ElevenLabs conversation disconnects.
 * Records a rich funnel event with transcript summary + learned context.
 * Also records to interactions table if the visitor has a person record.
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
    const { sessionId, voiceToken } = body as {
      sessionId?: string;
      voiceToken?: string;
    };

    if (!sessionId || !voiceToken) {
      return NextResponse.json({ error: "Missing sessionId or voiceToken" }, { status: 400 });
    }

    const { loadSessionForVoice, recordFunnelEvent } = await import(
      "../../../../../../../src/engine/network-chat"
    );

    const session = await loadSessionForVoice(sessionId, voiceToken);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Build transcript summary from voice turns (Brief 150 AC 8)
    const voiceTurns = session.messages.filter((m) => m.content?.startsWith("[voice]"));
    const transcriptSummary = voiceTurns.length > 0
      ? voiceTurns.slice(-10).map((m) => {
          const role = m.role === "user" ? "Visitor" : "Alex";
          return `${role}: ${m.content.replace("[voice] ", "")}`;
        }).join(" | ")
      : null;

    // Record rich funnel event with interaction metadata (Brief 150 AC 7-8)
    await recordFunnelEvent(sessionId, "voice_call_completed", session.context, {
      channel: "voice",
      provider: "elevenlabs",
      voiceTurnCount: voiceTurns.length,
      transcriptSummary: transcriptSummary?.slice(0, 1000),
      learned: session.learned,
    });

    // If the visitor has a person record, also record to interactions table
    if (session.authenticatedEmail) {
      try {
        const { db, schema } = await import("../../../../../../../src/db");
        const { eq } = await import("drizzle-orm");
        const { recordInteraction } = await import("../../../../../../../src/engine/people");

        // Look up person by email
        const [person] = await db
          .select()
          .from(schema.people)
          .where(eq(schema.people.email, session.authenticatedEmail));

        if (person) {
          await recordInteraction({
            personId: person.id,
            userId: person.userId,
            type: "introduction_received",
            channel: "voice",
            mode: "connecting",
            subject: "Voice call via front door",
            summary: transcriptSummary?.slice(0, 500) || "Voice call completed",
            outcome: "positive",
            metadata: {
              provider: "elevenlabs",
              voiceTurnCount: voiceTurns.length,
              learned: session.learned,
            },
          });
          console.log(`[voice/call-end] Interaction recorded for person ${person.id}`);
        }
      } catch (err) {
        // Non-fatal — funnel event already recorded
        console.warn("[voice/call-end] Interaction recording failed:", (err as Error).message);
      }
    }

    console.log(`[voice/call-end] Call ended for session ${sessionId.slice(0, 8)}... (${voiceTurns.length} voice turns)`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[voice/call-end] Error:", (err as Error).message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
