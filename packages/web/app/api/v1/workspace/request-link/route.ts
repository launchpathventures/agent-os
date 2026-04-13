/**
 * Ditto — Workspace Magic Link Request (Brief 143)
 *
 * POST /api/v1/workspace/request-link — accepts an email, validates it
 * matches WORKSPACE_OWNER_EMAIL, creates a magic link, and sends it
 * via AgentMail.
 *
 * Returns identical success message regardless of whether email matches
 * (prevent enumeration — same pattern as Brief 123 AC15).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_SUCCESS = "If this is the workspace owner email, you'll receive a magic link shortly. Check your email.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ message: GENERIC_SUCCESS });
    }

    const ownerEmail = process.env.WORKSPACE_OWNER_EMAIL;
    if (!ownerEmail) {
      // No owner configured — local dev, shouldn't reach here
      return NextResponse.json({ message: GENERIC_SUCCESS });
    }

    // Only send magic link if email matches owner (but always return same response)
    if (email.toLowerCase() !== ownerEmail.toLowerCase()) {
      return NextResponse.json({ message: GENERIC_SUCCESS });
    }

    try {
      const { createWorkspaceMagicLink } = await import(
        "../../../../../../../src/engine/magic-link"
      );

      const result = await createWorkspaceMagicLink(email.toLowerCase());

      if (result) {
        // Send via AgentMail directly (no interaction tracking for auth emails)
        const { createAgentMailAdapterForPersona } = await import(
          "../../../../../../../src/engine/channel"
        );

        const adapter = createAgentMailAdapterForPersona("alex");
        if (adapter) {
          const body = [
            "Here's your workspace login link:",
            "",
            result.url,
            "",
            "This link expires in 24 hours and can only be used once.",
          ].join("\n");

          await adapter.send({
            to: email.toLowerCase(),
            subject: "Ditto workspace login",
            body,
            personaId: "alex",
            mode: "nurture",
            includeOptOut: false,
            sendingIdentity: "principal",
          });
        }
      }
    } catch (err) {
      console.error("[workspace/request-link] Magic link error:", err);
      // Fall through — always return generic success
    }

    return NextResponse.json({ message: GENERIC_SUCCESS });
  } catch (error) {
    console.error("[workspace/request-link] Error:", error);
    return NextResponse.json({ message: GENERIC_SUCCESS });
  }
}
