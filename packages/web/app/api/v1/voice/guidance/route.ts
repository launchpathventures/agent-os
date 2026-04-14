/**
 * POST /api/v1/voice/guidance — Synchronous harness evaluation for voice guidance
 *
 * Called by the frontend client tool and eager pre-computation to get fresh
 * harness guidance for the voice agent. Evaluation-only — does NOT persist
 * messages (that's handled by /transcript and /session-updates).
 *
 * Returns guidance synchronously with a 6s timeout fallback to rule-based guidance.
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

    const { loadSessionForVoice, evaluateVoiceConversation, buildVoiceFallbackGuidance } = await import(
      "../../../../../../../src/engine/network-chat"
    );

    const session = await loadSessionForVoice(sessionId, voiceToken);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Initialize LLM if needed
    const llm = await import("../../../../../../../src/engine/llm");
    if (!llm.isMockLlmMode()) {
      try { llm.initLlm(); } catch { /* already initialized */ }
    }

    // Run harness evaluation with 6s timeout (client tool has ~10s before ElevenLabs times out)
    let evaluation: Awaited<ReturnType<typeof evaluateVoiceConversation>> = null;
    try {
      evaluation = await Promise.race([
        evaluateVoiceConversation(sessionId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
    } catch (err) {
      console.warn("[voice/guidance] Evaluation failed:", (err as Error).message);
    }

    if (evaluation) {
      console.log(`[voice/guidance] Stage: ${evaluation.stage}, guidance: ${evaluation.guidance.slice(0, 80)}...`);
      return NextResponse.json({
        guidance: evaluation.guidance,
        stage: evaluation.stage,
        learned: evaluation.learned,
      });
    }

    // Fallback: rule-based guidance when LLM is too slow or fails
    const fallback = buildVoiceFallbackGuidance(session.learned);
    console.log(`[voice/guidance] Using fallback: ${fallback}`);
    return NextResponse.json({
      guidance: fallback,
      stage: "gathering",
      learned: session.learned || {},
    });
  } catch (err) {
    console.error("[voice/guidance] Error:", (err as Error).message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
