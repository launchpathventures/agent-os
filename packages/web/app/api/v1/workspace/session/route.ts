/**
 * Ditto — Workspace Session API (Brief 143)
 *
 * GET /api/v1/workspace/session — reads workspace session cookie,
 * returns auth status.
 *
 * DELETE /api/v1/workspace/session — clears the session cookie (logout).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKSPACE_SESSION_COOKIE = "ditto_workspace_session";

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(WORKSPACE_SESSION_COOKIE);

  if (!session?.value) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    email: session.value,
  });
}

/**
 * DELETE /api/v1/workspace/session — logout (clear cookie).
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(WORKSPACE_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
