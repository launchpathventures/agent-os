/**
 * Ditto — Workspace Magic Link Request (Brief 143)
 *
 * POST /api/v1/workspace/request-link — accepts an email, validates it
 * matches WORKSPACE_OWNER_EMAIL, creates a magic link, and sends it
 * via AgentMail.
 *
 * Returns identical success message regardless of whether email matches
 * (prevent enumeration — same pattern as Brief 123 AC15).
 *
 * Hardened: logs every decision point so auth failures are diagnosable
 * without leaking information to the client.
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
      console.warn("[workspace/request-link] Invalid or missing email in request body");
      return NextResponse.json({ message: GENERIC_SUCCESS });
    }

    const ownerEmail = process.env.WORKSPACE_OWNER_EMAIL;
    if (!ownerEmail) {
      console.error(
        "[workspace/request-link] WORKSPACE_OWNER_EMAIL is not set. " +
        "Magic link auth is enabled in middleware but the owner email is missing from env. " +
        "Set WORKSPACE_OWNER_EMAIL in .env or Railway environment variables.",
      );
      return NextResponse.json({ message: GENERIC_SUCCESS });
    }

    // Only send magic link if email matches owner (but always return same response)
    if (email.toLowerCase() !== ownerEmail.toLowerCase()) {
      // Intentionally no detail — prevents enumeration
      return NextResponse.json({ message: GENERIC_SUCCESS });
    }

    // Validate NEXT_PUBLIC_APP_URL is set — magic links are useless without a domain
    const baseUrl = process.env.NETWORK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      console.error(
        "[workspace/request-link] Neither NETWORK_BASE_URL nor NEXT_PUBLIC_APP_URL is set. " +
        "Magic link URLs will have no domain and won't work from email clients. " +
        "Set NEXT_PUBLIC_APP_URL to your deployment URL (e.g. https://ditto.up.railway.app).",
      );
      // Continue anyway — link will still work if user manually prefixes domain
    }

    try {
      const { createWorkspaceMagicLink } = await import(
        "../../../../../../../src/engine/magic-link"
      );

      const result = await createWorkspaceMagicLink(email.toLowerCase());

      if (!result) {
        console.warn(
          `[workspace/request-link] createWorkspaceMagicLink returned null for ${email}. ` +
          "Likely rate-limited (max 5 per email per hour).",
        );
        return NextResponse.json({ message: GENERIC_SUCCESS });
      }

      console.info(`[workspace/request-link] Magic link created: ${result.url}`);

      // Send via AgentMail directly (no interaction tracking for auth emails)
      const { createAgentMailAdapterForPersona } = await import(
        "../../../../../../../src/engine/channel"
      );

      const adapter = createAgentMailAdapterForPersona("alex");
      if (!adapter) {
        console.error(
          "[workspace/request-link] AgentMail adapter is null — AGENTMAIL_API_KEY is not set. " +
          "Magic link was created but cannot be emailed. " +
          "Set AGENTMAIL_API_KEY, AGENTMAIL_ALEX_INBOX in .env or Railway environment variables. " +
          `Direct login URL (for debugging): ${result.url}`,
        );
        return NextResponse.json({ message: GENERIC_SUCCESS });
      }

      const emailBody = [
        "Here's your workspace login link:",
        "",
        result.url,
        "",
        "This link expires in 24 hours and can only be used once.",
      ].join("\n");

      await adapter.send({
        to: email.toLowerCase(),
        subject: "Ditto workspace login",
        body: emailBody,
        personaId: "alex",
        mode: "nurture",
        includeOptOut: false,
        sendingIdentity: "principal",
      });

      console.info(`[workspace/request-link] Magic link email sent to ${email}`);
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
