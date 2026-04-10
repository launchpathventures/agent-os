/**
 * Ditto — Request Magic Link Endpoint (Brief 123)
 *
 * POST /api/v1/chat/request-link — accepts an email, sends a magic link
 * if the email has an active session. Returns identical success message
 * regardless of whether email exists (AC15: prevent enumeration).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GENERIC_SUCCESS = "If you have an account, you'll receive a magic link shortly. Check your email.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      // Still return generic success to prevent enumeration
      return NextResponse.json({ message: GENERIC_SUCCESS });
    }

    // Load env vars
    if (!process.env.ANTHROPIC_API_KEY && !process.env.MOCK_LLM) {
      try {
        const { config } = await import("dotenv");
        const path = await import("path");
        config({ path: path.resolve(process.cwd(), "../../.env") });
      } catch { /* env vars may be set via platform */ }
    }

    // Try to generate and send a magic link (best-effort, always return same response)
    try {
      const { getMagicLinkForEmail } = await import("../../../../../../../src/engine/magic-link");
      const url = await getMagicLinkForEmail(email.toLowerCase());

      if (url) {
        // Send the magic link email
        const { sendAndRecord } = await import("../../../../../../../src/engine/channel");
        const { db, schema } = await import("../../../../../../../src/db");
        const { eq } = await import("drizzle-orm");

        // Find the network user and person for interaction tracking
        const [networkUser] = await db
          .select()
          .from(schema.networkUsers)
          .where(eq(schema.networkUsers.email, email.toLowerCase()))
          .limit(1);

        if (networkUser?.personId) {
          await sendAndRecord({
            to: email.toLowerCase(),
            subject: "Your chat link",
            body: [
              "Here's your link to continue our conversation:",
              "",
              url,
              "",
              "This link expires in 24 hours.",
            ].join("\n"),
            personaId: "alex",
            mode: "nurture",
            personId: networkUser.personId,
            userId: networkUser.id,
            includeOptOut: false,
            skipMagicLink: true, // Body already contains the link — don't add footer
          });
        }
      }
    } catch (err) {
      console.error("[/api/v1/chat/request-link] Magic link generation error:", err);
      // Fall through — always return generic success
    }

    return NextResponse.json({ message: GENERIC_SUCCESS });
  } catch (error) {
    console.error("[/api/v1/chat/request-link] Error:", error);
    // Even on error, return generic success to prevent enumeration
    return NextResponse.json({ message: GENERIC_SUCCESS });
  }
}
