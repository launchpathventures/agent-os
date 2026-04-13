/**
 * Unipile Integration API Routes (Brief 133, Brief 143)
 *
 * GET  /api/v1/integrations/unipile — list connected accounts
 * POST /api/v1/integrations/unipile — generate hosted auth link for connecting a new account
 *
 * Auth: gated by workspace session cookie when WORKSPACE_OWNER_EMAIL is set.
 * In local dev (no WORKSPACE_OWNER_EMAIL), accessible without auth.
 *
 * Unipile credentials loaded from env vars (UNIPILE_DSN, UNIPILE_API_KEY).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKSPACE_SESSION_COOKIE = "ditto_workspace_session";

/** Check workspace session. Returns 401 response if auth required but missing/invalid. */
async function checkWorkspaceAuth(): Promise<NextResponse | null> {
  if (!process.env.WORKSPACE_OWNER_EMAIL) return null; // Local dev — no auth needed
  const cookieStore = await cookies();
  const session = cookieStore.get(WORKSPACE_SESSION_COOKIE);
  if (!session?.value) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Validate cookie value contains the correct email (signed or legacy unsigned)
  const sepIdx = session.value.lastIndexOf("|");
  const email = sepIdx === -1 ? session.value : session.value.substring(0, sepIdx);
  if (email.toLowerCase() !== process.env.WORKSPACE_OWNER_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // Authenticated
}

function getUnipileConfig() {
  const dsn = process.env.UNIPILE_DSN;
  const apiKey = process.env.UNIPILE_API_KEY;
  if (!dsn || !apiKey) return null;
  return { dsn, apiKey };
}

/**
 * GET — List connected Unipile accounts.
 */
export async function GET() {
  const authErr = await checkWorkspaceAuth();
  if (authErr) return authErr;

  const config = getUnipileConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Unipile not configured. Set UNIPILE_DSN and UNIPILE_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const { UnipileClient } = await import("unipile-node-sdk");
    const client = new UnipileClient(config.dsn, config.apiKey);
    const accounts = await client.account.getAll();

    const items = (accounts as { items?: Array<Record<string, unknown>> }).items ?? [];

    return NextResponse.json({
      accounts: items.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name ?? a.id,
        status: a.status,
        created_at: a.created_at,
      })),
    });
  } catch (err) {
    console.error("[integrations/unipile] Failed to list accounts:", err);
    return NextResponse.json(
      { error: "Failed to list Unipile accounts." },
      { status: 500 },
    );
  }
}

/**
 * POST — Generate a hosted auth link for connecting a social account.
 *
 * Body: { provider?: "LINKEDIN" | "WHATSAPP" | "INSTAGRAM" | "TELEGRAM" }
 * Defaults to LINKEDIN.
 */
export async function POST(request: Request) {
  const authErr = await checkWorkspaceAuth();
  if (authErr) return authErr;

  const config = getUnipileConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Unipile not configured. Set UNIPILE_DSN and UNIPILE_API_KEY." },
      { status: 503 },
    );
  }

  let provider = "LINKEDIN";
  try {
    const body = await request.json().catch(() => ({}));
    if (body.provider) provider = String(body.provider).toUpperCase();
  } catch {
    // Use default
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const successRedirect = `${origin}/?settings=connections&connected=true`;

  try {
    const { UnipileClient } = await import("unipile-node-sdk");
    const client = new UnipileClient(config.dsn, config.apiKey);
    const result = await client.account.createHostedAuthLink({
      type: "create",
      api_url: config.dsn,
      providers: [provider as "LINKEDIN"],
      success_redirect_url: successRedirect,
      expiresOn: new Date(Date.now() + 3600000).toISOString(),
    });

    return NextResponse.json({ url: result.url, provider, expiresIn: 3600 });
  } catch (err) {
    console.error("[integrations/unipile] Failed to create auth link:", err);
    return NextResponse.json(
      { error: "Failed to generate connection link." },
      { status: 500 },
    );
  }
}
